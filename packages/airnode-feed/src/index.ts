import { go } from '@api3/promise-utils';

import { initiateSignedApiUpdateLoops } from './fetch-beacon-data';
import { initiateHeartbeatLoop } from './heartbeat';
import { logger } from './logger';
import { initializeState } from './state';
import { loadConfig } from './validation/config';

// Start the Airnode feed. All application errors should be handled by this function (or its callees) and any error from
// this function is considered unexpected.
const startAirnodeFeed = async () => {
  const goConfig = await go(loadConfig);
  if (!goConfig.success) {
    // Note, that the error should not expose any sensitive information.
    logger.error('Failed to load the configuration.', goConfig.error);
    return;
  }
  initializeState(goConfig.data);

  void initiateSignedApiUpdateLoops();
  initiateHeartbeatLoop();
};

const main = async () => {
  const goStartAirnodeFeed = await go(startAirnodeFeed);
  if (!goStartAirnodeFeed.success) {
    logger.error('Could not start Airnode feed. Unexpected error occurred.', goStartAirnodeFeed.error);
  }
};

void main();
