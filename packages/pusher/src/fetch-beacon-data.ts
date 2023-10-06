import { go } from '@api3/promise-utils';
import { isEmpty } from 'lodash';

import { makeTemplateRequests } from './api-requests/data-provider';
import { NO_FETCH_EXIT_CODE } from './constants';
import { logger } from './logger';
import { signTemplateResponses } from './sign-template-data';
import { getState } from './state';
import { sleep } from './utils';
import type { SignedApiUpdate } from './validation/schema';

export const initiateFetchingBeaconData = () => {
  logger.debug('Initiating fetching all beacon data');
  const { config } = getState();

  const { signedApiUpdates } = config.triggers;

  if (isEmpty(signedApiUpdates)) {
    logger.error('No signed API updates found. Stopping.');
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(NO_FETCH_EXIT_CODE);
  }

  return signedApiUpdates.map(async (element) => fetchBeaconDataInLoop(element));
};

const fetchBeaconDataInLoop = async (signedApiUpdate: SignedApiUpdate) => {
  const { templateValues } = getState();

  while (true) {
    const startTimestamp = Date.now();
    const templateResponses = await makeTemplateRequests(signedApiUpdate);
    const signedResponses = await signTemplateResponses(templateResponses);
    // eslint-disable-next-line unicorn/no-array-for-each
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

    await sleep(signedApiUpdate.fetchInterval * 1000 - duration);
  }
};
