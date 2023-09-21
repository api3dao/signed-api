import { isEmpty } from 'lodash';
import { logger } from './logging';
import { getState } from './state';
import { sleep } from './utils';
import { SignedApiUpdate } from './validation/schema';
import { NO_FETCH_EXIT_CODE } from './constants';
import { makeTemplateRequests } from './api-requests/data-provider';
import { signTemplateResponses } from './api-requests/signed-api';

export const initiateFetchingBeaconData = () => {
  logger.debug('Initiating fetching all beacon data');
  const { config } = getState();

  const signedApiUpdates = config.triggers.signedApiUpdates;

  if (isEmpty(signedApiUpdates)) {
    logger.error('No signed API updates found. Stopping.');
    process.exit(NO_FETCH_EXIT_CODE);
  }

  return signedApiUpdates.map(fetchBeaconDataInLoop);
};

const fetchBeaconDataInLoop = async (signedApiUpdate: SignedApiUpdate) => {
  const { templateValues } = getState();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const startTimestamp = Date.now();
    const templateResponses = await makeTemplateRequests(signedApiUpdate);
    const signedResponses = await signTemplateResponses(templateResponses);
    signedResponses.forEach(([templateId, signedResponse]) => templateValues[templateId]!.put(signedResponse));
    const duration = Date.now() - startTimestamp;

    await sleep(signedApiUpdate.fetchInterval * 1_000 - duration);
  }
};
