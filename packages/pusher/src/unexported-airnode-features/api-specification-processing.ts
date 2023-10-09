/* eslint-disable */
// Note that since the logic was last copied from Airnode, there has been some changes in the original Airnode
// implementation. Notably, the reserved paramaters are now inaccessible in processing.
//
// See: https://github.com/api3dao/airnode/issues/1738
import { ProcessingSpecification } from '@api3/ois';
import { go } from '@api3/promise-utils';
import * as node from '@api3/airnode-node';
import { unsafeEvaluate, unsafeEvaluateAsync } from './unsafe-evaluate';

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
