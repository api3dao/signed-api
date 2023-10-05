import { deriveBeaconId } from '@api3/airnode-node';
import { go } from '@api3/promise-utils';
import axios, { type AxiosError } from 'axios';
import { ethers } from 'ethers';
import { isEmpty, isNil, pick } from 'lodash';

import { logger } from '../logger';
import { getState } from '../state';
import type { SignedApiNameUpdateDelayGroup } from '../update-signed-api';
import { type SignedApiPayload, signedApiResponseSchema } from '../validation/schema';

export const postSignedApiData = async (group: SignedApiNameUpdateDelayGroup) => {
  const {
    config: { signedApis, airnodeWalletMnemonic },
    templateValues,
  } = getState();
  const { signedApiName, templateIds, updateDelay } = group;
  const logContext = { signedApiName, updateDelay };

  const airnode = ethers.Wallet.fromMnemonic(airnodeWalletMnemonic).address;
  const batchPayloadOrNull = templateIds.map((templateId): SignedApiPayload | null => {
    // Calculate the reference timestamp based on the current time and update delay.
    const referenceTimestamp = Date.now() / 1000 - updateDelay;
    const delayedSignedData = templateValues[templateId]!.get(referenceTimestamp);
    templateValues[templateId]!.prune();
    if (isNil(delayedSignedData)) return null;

    return { airnode, templateId, beaconId: deriveBeaconId(airnode, templateId), ...delayedSignedData };
  });

  const batchPayload = batchPayloadOrNull.filter((payload): payload is SignedApiPayload => !isNil(payload));

  if (isEmpty(batchPayload)) {
    logger.debug('No batch payload found to post. Skipping.', logContext);
    return { success: true, count: 0 };
  }

  logger.debug('Posting signed API data.', { group, ...logContext });
  const provider = signedApis.find((a) => a.name === signedApiName)!;
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
      {
        ...logContext,
        axiosResponse: pick(goAxiosRequest.error.response, ['data', 'status', 'headers']),
        errorMessage: goAxiosRequest.error.message,
      }
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

  const { count } = parsedResponse.data;
  logger.info(`Pushed signed data updates to the signed API.`, { ...logContext, count });
  return { success: true, count };
};
