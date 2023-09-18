import { isEmpty } from 'lodash';
import { logger } from './logging';
import { getState } from './state';
import { makeTemplateRequests, signTemplateResponses } from './make-request';
import { sleep } from './utils';
import { SignedApiUpdate } from './validation';
import { NO_FETCH_EXIT_CODE } from './constants';

export const initiateFetchingBeaconData = async () => {
  logger.debug('Initiating fetching all beacon data');
  const { config } = getState();

  const signedApiUpdates = config.triggers.signedApiUpdates;

  if (isEmpty(signedApiUpdates)) {
    logger.error('No signed API updates found. Stopping.');
    process.exit(NO_FETCH_EXIT_CODE);
  }

  return signedApiUpdates.map(fetchBeaconDataInLoop);
};

/**
 * Calling "fetchBeaconData" in a loop every "fetchInterval" seconds until the stop signal has been received.
 *
 * Opted in for while loop approach (instead of recursive scheduling of setTimeout) to make sure "fetchBeaconData" calls
 * do not overlap. We measure the total running time of the "fetchBeaconData" and then wait the remaining time
 * accordingly.
 *
 * It is possible that the gateway is down and that the data fetching will take the full "fetchInterval" duration. In
 * that case we do not want to wait, but start calling the gateway immediately as part of the next fetch cycle.
 */
export const fetchBeaconDataInLoop = async (signedApiUpdate: SignedApiUpdate) => {
  const { templateValues } = getState();

  let lastExecute = 0;
  let waitTime = 0;

  while (!getState().stopSignalReceived) {
    if (Date.now() - lastExecute > waitTime) {
      lastExecute = Date.now();
      const startTimestamp = Date.now();

      const templateResponses = await makeTemplateRequests(signedApiUpdate);
      const signedResponses = await signTemplateResponses(templateResponses);
      signedResponses.forEach(([templateId, signedResponse]) => templateValues[templateId].put(signedResponse));

      const duration = Date.now() - startTimestamp;
      waitTime = Math.max(0, signedApiUpdate.fetchInterval * 1_000 - duration);
    }

    await sleep(1_000); // regularly re-assess the stop interval
  }
};
