import { deriveBeaconId } from '@api3/airnode-node';
import { go } from '@api3/promise-utils';
import axios, { type AxiosError } from 'axios';
import { isEmpty, isNil, pick } from 'lodash';

import { logger } from '../logger';
import type { SignedResponse } from '../sign-template-data';
import { getState } from '../state';
import { type SignedApiPayload, signedApiResponseSchema } from '../validation/schema';

export const pushSignedData = async (signedResponses: SignedResponse[]) => {
  const {
    config: { signedApis },
    airnodeWallet,
  } = getState();

  const airnode = airnodeWallet.address;
  const batchPayloadOrNull = signedResponses.map(([templateId, signedData]): SignedApiPayload | null => {
    return { airnode, templateId, beaconId: deriveBeaconId(airnode, templateId), ...signedData };
  });
  const batchPayload = batchPayloadOrNull.filter((payload): payload is SignedApiPayload => !isNil(payload));
  if (isEmpty(batchPayload)) {
    logger.debug('No batch payload found to post. Skipping.');
    return null;
  }

  const promises = signedApis.map(async (signedApi) => {
    return logger.runWithContext({ signedApiName: signedApi.name }, async () => {
      logger.debug('Pushing signed data to the signed API.');
      const goAxiosRequest = await go<Promise<unknown>, AxiosError>(async () => {
        logger.debug('Posting batch payload.', { batchPayload });
        const axiosResponse = await axios.post(new URL(airnode, signedApi.url).href, batchPayload, {
          headers: {
            'Content-Type': 'application/json',
            ...(signedApi.authToken ? { Authorization: `Bearer ${signedApi.authToken}` } : {}),
          },
        });

        return axiosResponse.data;
      });
      if (!goAxiosRequest.success) {
        logger.warn(
          `Failed to make update signed API request.`,
          // See: https://axios-http.com/docs/handling_errors
          {
            axiosResponse: pick(goAxiosRequest.error.response, ['data', 'status', 'headers']),
            errorMessage: goAxiosRequest.error.message,
          }
        );
        return { success: false };
      }

      logger.debug('Parsing response from the signed API.', { axiosResponse: goAxiosRequest.data });
      const parsedResponse = signedApiResponseSchema.safeParse(goAxiosRequest.data);
      if (!parsedResponse.success) {
        logger.warn('Failed to parse response from the signed API.', {
          errors: parsedResponse.error,
        });
        return { success: false };
      }

      const { count } = parsedResponse.data;
      logger.info(`Pushed signed data updates to the signed API.`, { count });
      return { success: true, count };
    });
  });

  return Promise.all(promises);
};
