import * as abi from '@api3/airnode-abi';
import * as node from '@api3/airnode-node';
import { isNil } from 'lodash';
import { getState } from '../state';
import { preProcessApiSpecifications } from '../unexported-airnode-features/api-specification-processing';
import { SignedApiUpdate, TemplateId } from '../validation/schema';
import { getLogger } from '../logger';

type TemplateResponse = [TemplateId, node.HttpGatewayApiCallSuccessResponse];
type TemplateResponses = TemplateResponse[];

export const callApi = async (payload: node.ApiCallPayload) => {
  getLogger().debug('Preprocessing API call payload', { aggregateApiCall: payload.aggregatedApiCall });
  const processedPayload = await preProcessApiSpecifications(payload);
  getLogger().debug('Performing API call', { aggregateApiCall: payload.aggregatedApiCall });
  return node.api.performApiCall(processedPayload);
};

export const makeTemplateRequests = async (signedApiUpdate: SignedApiUpdate): Promise<TemplateResponses> => {
  const {
    config: { beacons, endpoints, templates, ois, apiCredentials },
    apiLimiters,
  } = getState();
  getLogger().debug('Making template requests', signedApiUpdate);
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
    getLogger().warn(message, { operationTemplateId });
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

    getLogger().debug('Processing successful API call', { templateId, operationTemplateId });
    const [_, response] = await node.api.processSuccessfulApiCall(payload, apiCallResponse);

    if (!response.success) {
      const message = `Failed to post process successful API call`;
      getLogger().warn(message, { templateId, operationTemplateId, errorMessage: response.errorMessage });
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
