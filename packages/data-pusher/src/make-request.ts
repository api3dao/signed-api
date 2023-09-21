import { isEmpty, isNil } from 'lodash';
import axios, { AxiosError } from 'axios';
import { ethers } from 'ethers';
import * as adapter from '@api3/airnode-adapter';
import * as node from '@api3/airnode-node';
import * as abi from '@api3/airnode-abi';
import { go, goSync } from '@api3/promise-utils';
import { Endpoint, ProcessingSpecification } from '@api3/ois';
import { logger } from './logging';
import { SignedApiPayload, SignedApiUpdate, SignedData, TemplateId } from './validation/schema';
import { getState } from './state';
import { unsafeEvaluate, unsafeEvaluateAsync } from './unexported-airnode-features/unsafe-evaluate';
import { SignedApiNameUpdateDelayGroup } from './update-signed-api';

type TemplateResponse = [TemplateId, node.HttpGatewayApiCallSuccessResponse];
type TemplateResponses = TemplateResponse[];
type SignedResponse = [TemplateId, SignedData];

export const postProcessApiSpecifications = async (input: unknown, endpoint: Endpoint) => {
  const { postProcessingSpecifications } = endpoint;

  if (!postProcessingSpecifications || postProcessingSpecifications?.length === 0) {
    return input;
  }

  const goResult = await go(
    () =>
      postProcessingSpecifications.reduce(async (input: any, currentValue: ProcessingSpecification) => {
        switch (currentValue.environment) {
          case 'Node':
            return unsafeEvaluate(await input, currentValue.value, currentValue.timeoutMs);
          case 'Node async':
            return unsafeEvaluateAsync(await input, currentValue.value, currentValue.timeoutMs);
          default:
            throw new Error(`Environment ${currentValue.environment} is not supported`);
        }
      }, Promise.resolve(input)),

    { retries: 0, totalTimeoutMs: node.PROCESSING_TIMEOUT }
  );

  if (!goResult.success) {
    throw goResult.error;
  }

  return goResult.data;
};

export async function processSuccessfulApiCall(
  payload: node.ApiCallPayload,
  rawResponse: node.api.PerformApiCallSuccess
): Promise<node.ApiCallResponse> {
  const { config, aggregatedApiCall } = payload;
  const { endpointName, oisTitle, parameters } = aggregatedApiCall;
  const ois = config.ois.find((o) => o.title === oisTitle)!;
  const endpoint = ois.endpoints.find((e) => e.name === endpointName)!;
  // _minConfirmations is handled prior to the API call
  const { _type, _path, _times } = node.adapters.http.parameters.getReservedParameters(endpoint, parameters);

  const goPostProcessApiSpecifications = await go(() =>
    postProcessApiSpecifications({ data: rawResponse.data, parameters }, endpoint)
  );
  if (!goPostProcessApiSpecifications.success) {
    logger.error(goPostProcessApiSpecifications.error.message);
    return { success: false, errorMessage: goPostProcessApiSpecifications.error.message };
  }

  const goExtractAndEncodeResponse = goSync(() =>
    adapter.extractAndEncodeResponse(goPostProcessApiSpecifications.data, {
      _type,
      _path,
      _times,
    } as adapter.ResponseReservedParameters)
  );
  if (!goExtractAndEncodeResponse.success) {
    logger.error(goExtractAndEncodeResponse.error.message);
    return { success: false, errorMessage: goExtractAndEncodeResponse.error.message };
  }

  const response = goExtractAndEncodeResponse.data;

  return { success: true, data: response };
}

export const preProcessApiSpecifications = async (payload: node.ApiCallPayload): Promise<node.ApiCallPayload> => {
  const { config, aggregatedApiCall } = payload;
  const { endpointName, oisTitle } = aggregatedApiCall;
  const ois = config.ois.find((o) => o.title === oisTitle)!;
  const { preProcessingSpecifications } = ois.endpoints.find((e) => e.name === endpointName)!;

  if (!preProcessingSpecifications || preProcessingSpecifications.length === 0) {
    return payload;
  }

  const goProcessedParameters = await go(
    () =>
      preProcessingSpecifications.reduce(async (input: Promise<unknown>, currentValue: ProcessingSpecification) => {
        switch (currentValue.environment) {
          case 'Node':
            return unsafeEvaluate(await input, currentValue.value, currentValue.timeoutMs);
          case 'Node async':
            return unsafeEvaluateAsync(await input, currentValue.value, currentValue.timeoutMs);
          default:
            throw new Error(`Environment ${currentValue.environment} is not supported`);
        }
      }, Promise.resolve(aggregatedApiCall.parameters)),
    { retries: 0, totalTimeoutMs: node.PROCESSING_TIMEOUT }
  );

  if (!goProcessedParameters.success) {
    throw goProcessedParameters.error;
  }

  // Let this throw if the processed parameters are invalid
  const parameters = node.apiCallParametersSchema.parse(goProcessedParameters.data);

  return {
    ...payload,
    aggregatedApiCall: {
      ...aggregatedApiCall,
      parameters,
    },
  } as node.ApiCallPayload;
};

export const callApi = async (payload: node.ApiCallPayload) => {
  const processedPayload = await preProcessApiSpecifications(payload);
  return node.api.performApiCall(processedPayload);
};

export const signWithTemplateId = (templateId: string, timestamp: string, data: string) => {
  const { walletPrivateKey } = getState();

  return new ethers.Wallet(walletPrivateKey).signMessage(
    ethers.utils.arrayify(
      ethers.utils.keccak256(
        ethers.utils.solidityPack(['bytes32', 'uint256', 'bytes'], [templateId, timestamp, data || '0x'])
      )
    )
  );
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

    const response = await processSuccessfulApiCall(payload, apiCallResponse);

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

export const signTemplateResponses = async (templateResponses: TemplateResponses) => {
  const signPromises = templateResponses.map(async ([templateId, response]) => {
    const encodedValue = response.data.encodedValue;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const goSignWithTemplateId = await go(() => signWithTemplateId(templateId, timestamp, encodedValue));
    if (!goSignWithTemplateId.success) {
      const message = `Failed to sign response. Error: "${goSignWithTemplateId.error}"`;
      logger.warn(message, {
        meta: { 'Template-ID': templateId },
      });
      return null;
    }

    return [
      templateId,
      {
        timestamp: timestamp,
        encodedValue: encodedValue,
        signature: goSignWithTemplateId.data,
      },
    ];
  });
  const signedResponsesOrNull = await Promise.all(signPromises);
  const signedResponses = signedResponsesOrNull.filter((response): response is SignedResponse => !isNil(response));

  return signedResponses;
};

export const postSignedApiData = async (group: SignedApiNameUpdateDelayGroup) => {
  const {
    config: { beacons, signedApis },
    templateValues,
  } = getState();
  const { providerName, beaconIds, updateDelay } = group;

  const logOptions = { meta: { Provider: providerName, 'Update-delay': updateDelay.toString() } };

  const provider = signedApis.find((a) => a.name === providerName)!;

  const batchPayloadOrNull = beaconIds.map((beaconId): SignedApiPayload | null => {
    const { templateId, airnode } = beacons[beaconId]!;
    const delayedSignedData = templateValues[templateId]!.get(updateDelay);
    if (isNil(delayedSignedData)) return null;
    return { airnode, templateId, beaconId, ...delayedSignedData };
  });

  const batchPayload = batchPayloadOrNull.filter((payload): payload is SignedApiPayload => !isNil(payload));

  if (isEmpty(batchPayload)) {
    logger.debug('No batch payload found to post skipping.', logOptions);
    return;
  }
  const goRes = await go<Promise<{ count: number }>, AxiosError>(async () => {
    const axiosResponse = await axios.post(provider.url, batchPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return axiosResponse.data;
  });

  if (!goRes.success) {
    logger.warn(
      // See: https://axios-http.com/docs/handling_errors
      `Failed to post payload to update signed API. Err: ${goRes.error}, axios response: ${goRes.error.response}`,
      logOptions
    );
    return;
  }
  logger.info(`Pushed ${goRes.data.count.toString()} signed data updates to the pool.`, logOptions);
};
