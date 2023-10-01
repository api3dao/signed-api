import * as node from '@api3/airnode-node';
import { isNil, pick } from 'lodash';
import { getState } from '../state';
import { preProcessApiSpecifications } from '../unexported-airnode-features/api-specification-processing';
import { SignedApiUpdate } from '../validation/schema';
import { logger } from '../logger';
import { TemplateResponse } from '../sign-template-data';

export const callApi = async (payload: node.ApiCallPayload) => {
  logger.debug('Preprocessing API call payload', pick(payload.aggregatedApiCall, ['endpointName', 'oisTitle']));
  const processedPayload = await preProcessApiSpecifications(payload);
  logger.debug('Performing API call', { processedPayload: processedPayload });
  return node.api.performApiCall(processedPayload);
};

export const makeTemplateRequests = async (signedApiUpdate: SignedApiUpdate): Promise<TemplateResponse[]> => {
  const {
    config: { endpoints, templates, ois, apiCredentials },
    apiLimiters,
  } = getState();
  logger.debug('Making template requests', signedApiUpdate);
  const { templateIds } = signedApiUpdate;

  // Because each template has the same operation, just take first one as operational template. See the validation logic
  // for details.
  const operationTemplateId = templateIds[0]!;
  const operationTemplate = templates[operationTemplateId]!;
  const endpoint = endpoints[operationTemplate.endpointId]!;
  const parameters = operationTemplate.parameters.reduce((acc, parameter) => {
    return {
      ...acc,
      [parameter.name]: parameter.value,
    };
  }, {});
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
    logger.warn(message, { operationTemplateId });
    return [];
  }

  const templateResponsePromises = templateIds.map(async (templateId) => {
    const template = templates[templateId]!;
    const endpoint = endpoints[template.endpointId]!;

    const parameters = template.parameters.reduce((acc, parameter) => {
      return {
        ...acc,
        [parameter.name]: parameter.value,
      };
    }, {});
    const aggregatedApiCall: node.BaseAggregatedApiCall = {
      parameters,
      ...endpoint,
    };
    const payload: node.ApiCallPayload = {
      type: 'http-gateway',
      config: { ois, apiCredentials },
      aggregatedApiCall,
    };

    logger.debug('Processing successful API call', { templateId, operationTemplateId });
    const [_, response] = await node.api.processSuccessfulApiCall(payload, apiCallResponse);

    if (!response.success) {
      const message = `Failed to post process successful API call`;
      logger.warn(message, { templateId, operationTemplateId, errorMessage: response.errorMessage });
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
