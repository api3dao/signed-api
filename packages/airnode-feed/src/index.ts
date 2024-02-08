import { initiateSignedApiUpdateLoops } from './fetch-beacon-data';
import { initiateHeartbeatLoop } from './heartbeat';
import { logger } from './logger';
import { initializeState } from './state';
import { loadConfig } from './validation/config';

const setupUncaughtErrorHandler = () => {
  // NOTE: From the Node.js docs:
  //
  // Installing an 'uncaughtExceptionMonitor' listener does not change the behavior once an 'uncaughtException' event is
  // emitted. The process will still crash if no 'uncaughtException' listener is installed.
  process.on('uncaughtExceptionMonitor', (error, origin) => {
    logger.error('Uncaught exception.', error, { origin });
  });

  // We want to exit the process immediately to avoid Node.js to log the uncaught error to stderr.
  process.on('uncaughtException', () => process.exit(1));
  process.on('unhandledRejection', () => process.exit(1));
};

// Start the Airnode feed. All application errors should be handled by this function (or its callees) and any error from
// this function is considered unexpected.
const startAirnodeFeed = async () => {
  const config = await loadConfig();
  if (!config) return;
  initializeState(config);

  void initiateSignedApiUpdateLoops();
  initiateHeartbeatLoop();
};

const main = async () => {
  setupUncaughtErrorHandler();

  await startAirnodeFeed();
};

void main();
