import * as abi from '@api3/airnode-abi';
import * as node from '@api3/airnode-node';
import { isNil } from 'lodash';
import { logger } from '../logging';
import { getState } from '../state';
import { preProcessApiSpecifications } from '../unexported-airnode-features/api-specification-processing';
import { SignedApiUpdate, TemplateId } from '../validation/schema';

type TemplateResponse = [TemplateId, node.HttpGatewayApiCallSuccessResponse];
type TemplateResponses = TemplateResponse[];

export const callApi = async (payload: node.ApiCallPayload) => {
  const processedPayload = await preProcessApiSpecifications(payload);
  return node.api.performApiCall(processedPayload);
};

export const makeTemplateRequests = async (signedApiUpdate: SignedApiUpdate): Promise<TemplateResponses> => {
  const {
    config: { beacons, endpoints, templates, ois, apiCredentials },
    apiLimiters,
  } = getState();
  const { beaconIds } = signedApiUpdate;

  // Because each beacon have same operation, just take first one as operational template
  // See the function validateTriggerReferences in validation.ts
  const operationTemplateId = beacons[beaconIds[0]!]!.templateId;
  const operationTemplate = templates[operationTemplateId]!;

  const parameters = abi.decode(operationTemplate.parameters);
  const endpoint = endpoints[operationTemplate.endpointId]!;

  const aggregatedApiCall: node.BaseAggregatedApiCall = {
    parameters,
    ...endpoint,
  };

  const limiter = apiLimiters[operationTemplateId];

  const operationPayload: node.ApiCallPayload = {
    type: 'http-gateway',
    config: { ois, apiCredentials },
    aggregatedApiCall,
  };

  const [_, apiCallResponse] = await (limiter
    ? limiter.schedule({ expiration: 90_000 }, () => callApi(operationPayload))
    : callApi(operationPayload));

  if (node.api.isPerformApiCallFailure(apiCallResponse)) {
    const message = `Failed to make API call for the endpoint [${endpoint.oisTitle}] ${endpoint.endpointName}.`;
    logger.warn(message, { meta: { 'Operation-Template-ID': operationTemplateId } });
    return [];
  }

  const templateIds = beaconIds.map((beaconId) => beacons[beaconId]!.templateId);

  const templateResponsePromises = templateIds.map(async (templateId) => {
    const template = templates[templateId]!;
    const parameters = abi.decode(template.parameters);
    const endpoint = endpoints[template.endpointId]!;

    const aggregatedApiCall: node.BaseAggregatedApiCall = {
      parameters,
      ...endpoint,
    };
    const payload: node.ApiCallPayload = {
      type: 'http-gateway',
      config: { ois, apiCredentials },
      aggregatedApiCall,
    };

    const [_, response] = await node.api.processSuccessfulApiCall(payload, apiCallResponse);

    if (!response.success) {
      const message = `Failed to post process successful API call`;
      logger.warn(message, {
        meta: { 'Template-ID': templateId, 'Operation-Template-ID': operationTemplateId },
      });
      return null;
    }
    return [templateId, response];
  });

  const templateResponsesOrNull = await Promise.all(templateResponsePromises);

  const templateResponses = templateResponsesOrNull.filter(
    (response): response is TemplateResponse => !isNil(response)
  );

  return templateResponses;
};
