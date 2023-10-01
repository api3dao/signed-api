import { isEmpty } from 'lodash';
import { go } from '@api3/promise-utils';
import { logger } from './logger';
import { getState } from './state';
import { sleep } from './utils';
import { SignedApiUpdate } from './validation/schema';
import { NO_FETCH_EXIT_CODE } from './constants';
import { makeTemplateRequests } from './api-requests/data-provider';
import { signTemplateResponses } from './sign-template-data';

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
    signedResponses.forEach(async ([templateId, signedResponse]) => {
      const goPut = await go(() => templateValues[templateId]!.put(signedResponse));
      if (!goPut.success) {
        // Because there can be multiple triggers for the same template ID it is possible that a race condition occurs,
        // where the (newer) response from a different trigger is put first. This throws, because the signed data must
        // be inserted increasingly by timestamp.
        logger.warn(`Could not put signed response`, { templateId, signedResponse, errorMessage: goPut.error.message });
      }
    });
    const duration = Date.now() - startTimestamp;

    await sleep(signedApiUpdate.fetchInterval * 1_000 - duration);
  }
};
