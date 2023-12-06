import { go } from '@api3/promise-utils';

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
  const { templateValues } = getState();

  while (true) {
    const startTimestamp = Date.now();
    logger.debug('Making template requests.');
    const templateResponses = await makeTemplateRequests(signedApiUpdate);

    logger.debug('Signing template responses.');
    const signedResponses = await signTemplateResponses(templateResponses);

    logger.debug('Putting signed responses to storage.');
    await Promise.all(
      signedResponses.map(async ([templateId, signedResponse]) => {
        const goPut = await go(() => templateValues[templateId]!.put(signedResponse));
        if (!goPut.success) {
          // Because there can be multiple triggers for the same template ID it is possible that a race condition
          // occurs, where the (newer) response from a different trigger is put first. This throws, because the signed
          // data must be inserted increasingly by timestamp.
          logger.debug(`Could not put signed response.`, {
            templateId,
            signedResponse,
            errorMessage: goPut.error.message,
          });
        }
      })
    );

    // We want to send the data to the Signed API "in background" without waiting for the response to avoid blocking the
    // fetch interval loop.
    logger.debug('Scheduling pushing signed data to the API.');
    schedulePushingSignedData(signedApiUpdate);

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
