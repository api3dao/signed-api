import { deriveBeaconId } from '@api3/airnode-node';
import { executeRequest } from '@api3/commons';
import { isEmpty, isNil } from 'lodash';

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
      const requestResult = await executeRequest({
        method: 'post',
        url: new URL(airnode, signedApi.url).href,
        body: batchPayload,
        headers: {
          'Content-Type': 'application/json',
          ...(signedApi.authToken ? { Authorization: `Bearer ${signedApi.authToken}` } : {}),
        },
      });
      if (!requestResult.success) {
        logger.warn(`Failed to make update signed API request.`, requestResult.errorData);
        return { success: false };
      }

      logger.debug('Parsing response from the signed API.', { response: requestResult.data });
      const parsedResponse = signedApiResponseSchema.safeParse(requestResult.data);
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
