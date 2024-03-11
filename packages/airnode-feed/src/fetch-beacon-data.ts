import { makeTemplateRequests } from './api-requests/data-provider';
import { logger } from './logger';
import { signTemplateResponses } from './sign-template-data';
import { getState } from './state';
import { schedulePushingSignedData } from './update-signed-api';
import { sleep } from './utils';
import type { SignedApiUpdate } from './validation/schema';

export const initiateSignedApiUpdateLoops = () => {
  logger.debug('Initiating feed loop.');
  const { config } = getState();

  return config.triggers.signedApiUpdates.map(async (signedApiUpdate) => initiateSignedApiUpdateLoop(signedApiUpdate));
};

const initiateSignedApiUpdateLoop = async (signedApiUpdate: SignedApiUpdate) => {
  while (true) {
    const startTimestamp = Date.now();
    logger.debug('Making template requests.');
    const templateResponses = await makeTemplateRequests(signedApiUpdate);

    if (templateResponses) {
      logger.debug('Signing template responses.');
      const signedResponses = await signTemplateResponses(templateResponses);

      // We want to send the data to the Signed API "in background" without waiting for the response to avoid blocking
      // the fetch interval loop.
      logger.debug('Scheduling pushing signed data to the API.');
      await schedulePushingSignedData(signedResponses);
    }

    const duration = Date.now() - startTimestamp;
    // Take at most 10% of the fetch interval as extra time to avoid all API requests be done at the same time. This
    // delay is taken for each interval, so if the system runs for a sufficiently long time, the requests should happen
    // at random intervals.
    const extraTime = Math.random() * signedApiUpdate.fetchInterval * 1000 * 0.1;
    logger.debug('Adding extra time to fetch interval.', {
      extraTime,
      fetchInterval: signedApiUpdate.fetchInterval * 1000,
    });

    await sleep(signedApiUpdate.fetchInterval * 1000 - duration + extraTime);
  }
};
