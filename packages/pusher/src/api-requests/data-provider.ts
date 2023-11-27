import { type BuildRequestOptions, buildAndExecuteRequest, extractAndEncodeResponse } from '@api3/airnode-adapter';
import type * as node from '@api3/airnode-node';
import { getReservedParameters } from '@api3/airnode-node/dist/src/adapters/http/parameters';
import { preProcessApiCallParameters, type ApiCallParameters, postProcessApiCallResponse } from '@api3/commons';
import type { OIS, Endpoint as OisEndpoint } from '@api3/ois';
import { go, goSync } from '@api3/promise-utils';
import { isNil } from 'lodash';

import { API_CALL_TIMEOUT } from '../constants';
import { logger } from '../logger';
import type { TemplateResponse } from '../sign-template-data';
import { getState } from '../state';
import type { SignedApiUpdate } from '../validation/schema';

export const callApi = async (
  ois: OIS,
  endpoint: OisEndpoint,
  apiCallParameters: ApiCallParameters,
  apiCredentials: node.ApiCredentials[]
) => {
  return go(async () => {
    const logContext = { endpointName: endpoint.name, oisTitle: ois.title };
    logger.debug('Preprocessing API call payload', logContext);
    const processedApiCallParameters = await preProcessApiCallParameters(endpoint, apiCallParameters);
    logger.debug('Performing API call', { ...logContext, processedApiCallParameters });

    const response = await buildAndExecuteRequest(
      {
        endpointName: endpoint.name,
        ois: ois as BuildRequestOptions['ois'], // TS doesn't realize the types are the same because of https://github.com/microsoft/TypeScript/issues/26627#issuecomment-416046113.
        parameters: processedApiCallParameters,
        metadata: null,
        apiCredentials,
      },
      { timeout: API_CALL_TIMEOUT }
    );

    return response.data;
  });
};

export const makeTemplateRequests = async (signedApiUpdate: SignedApiUpdate): Promise<TemplateResponse[]> => {
  const {
    config: { endpoints, templates, ois: oises, apiCredentials },
  } = getState();
  logger.debug('Making template requests', signedApiUpdate);
  const { templateIds } = signedApiUpdate;

  // Because each template has the same operation, just take first one as operational template. See the validation logic
  // for details.
  const operationTemplateId = templateIds[0]!;
  const operationTemplate = templates[operationTemplateId]!;
  const operationEndpoint = endpoints[operationTemplate.endpointId]!;
  const ois = oises.find((o) => o.title === operationEndpoint.oisTitle)!;
  const operationOisEndpoint = ois.endpoints.find((e) => e.name === operationEndpoint.endpointName)!;
  const operationApiCallParameters = operationTemplate.parameters.reduce((acc, parameter) => {
    return {
      ...acc,
      [parameter.name]: parameter.value,
    };
  }, {});

  const goCallApi = await callApi(ois, operationOisEndpoint, operationApiCallParameters, apiCredentials);

  if (!goCallApi.success) {
    logger.warn(`Failed to make API call`, {
      ...operationEndpoint,
      operationTemplateId,
      errorMessage: goCallApi.error.message,
    });
    return [];
  }
  const apiCallResponse = goCallApi.data;

  const templateResponsePromises = templateIds.map(async (templateId) => {
    const template = templates[templateId]!;
    const endpoint = endpoints[template.endpointId]!;
    const oisEndpoint = ois.endpoints.find((e) => e.name === endpoint.endpointName)!;

    const apiCallParameters = template.parameters.reduce((acc, parameter) => {
      return {
        ...acc,
        [parameter.name]: parameter.value,
      };
    }, {});

    logger.debug('Processing successful API call', { templateId, operationTemplateId });
    const goPostProcess = await go(async () =>
      postProcessApiCallResponse(apiCallResponse, oisEndpoint, apiCallParameters)
    );
    if (!goPostProcess.success) {
      const message = `Failed to post process successful API call`;
      logger.warn(message, { templateId, operationTemplateId, errorMessage: goPostProcess.error.message });
      return null;
    }

    const goEncodedResponse = goSync(() => {
      const { _type, _path, _times } = getReservedParameters(
        oisEndpoint as Parameters<typeof getReservedParameters>[0], // TS doesn't realize the types are the same because of https://github.com/microsoft/TypeScript/issues/26627#issuecomment-416046113.
        apiCallParameters
      );
      return extractAndEncodeResponse(goPostProcess.data, {
        _type,
        _path,
        _times,
      });
    });
    if (!goEncodedResponse.success) {
      logger.warn(`Failed to encode response`, {
        templateId,
        operationTemplateId,
        errorMessage: goEncodedResponse.error.message,
      });
      return null;
    }

    return [templateId, goEncodedResponse.data] as const;
  });

  const templateResponsesOrNull = await Promise.all(templateResponsePromises);

  const templateResponses = templateResponsesOrNull.filter(
    (response): response is TemplateResponse => !isNil(response)
  );

  return templateResponses;
};
