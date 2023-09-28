import { go } from '@api3/promise-utils';
import axios, { AxiosError } from 'axios';
import { isEmpty, isNil } from 'lodash';
import { ethers } from 'ethers';
import { deriveBeaconId } from '@api3/airnode-node';
import { logger } from '../logger';
import { getState } from '../state';
import { SignedApiNameUpdateDelayGroup } from '../update-signed-api';
import { SignedApiPayload, signedApiResponseSchema } from '../validation/schema';

export const postSignedApiData = async (group: SignedApiNameUpdateDelayGroup) => {
  const {
    config: { signedApis, airnodeWalletMnemonic },
    templateValues,
  } = getState();
  const { signedApiName, templateIds, updateDelay } = group;
  const logContext = { signedApiName, updateDelay };
  logger.debug('Posting signed API data.', { group, ...logContext });

  const provider = signedApis.find((a) => a.name === signedApiName)!;

  const airnode = ethers.Wallet.fromMnemonic(airnodeWalletMnemonic).address;
  const batchPayloadOrNull = templateIds.map((templateId): SignedApiPayload | null => {
    const delayedSignedData = templateValues[templateId]!.get(updateDelay);
    if (isNil(delayedSignedData)) return null;

    return { airnode, templateId, beaconId: deriveBeaconId(airnode, templateId), ...delayedSignedData };
  });

  const batchPayload = batchPayloadOrNull.filter((payload): payload is SignedApiPayload => !isNil(payload));

  if (isEmpty(batchPayload)) {
    logger.debug('No batch payload found to post. Skipping.', logContext);
    return { success: true, count: 0 };
  }
  const goAxiosRequest = await go<Promise<unknown>, AxiosError>(async () => {
    logger.debug('Posting batch payload.', { ...logContext, batchPayload });
    const axiosResponse = await axios.post(provider.url, batchPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return axiosResponse.data;
  });
  if (!goAxiosRequest.success) {
    logger.warn(
      `Failed to make update signed API request.`,
      // See: https://axios-http.com/docs/handling_errors
      { ...logContext, axiosResponse: goAxiosRequest.error.response }
    );
    return { success: false };
  }

  logger.debug('Parsing response from the signed API.', { ...logContext, axiosResponse: goAxiosRequest.data });
  const parsedResponse = signedApiResponseSchema.safeParse(goAxiosRequest.data);
  if (!parsedResponse.success) {
    logger.warn('Failed to parse response from the signed API.', {
      ...logContext,
      errors: parsedResponse.error,
    });
    return { success: false };
  }

  const count = parsedResponse.data.count;
  logger.info(`Pushed signed data updates to the signed API.`, { ...logContext, count });
  return { success: true, count };
};
