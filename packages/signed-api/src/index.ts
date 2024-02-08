import { go } from '@api3/promise-utils';
import z from 'zod';

import { loadAndCacheConfig } from './config/config';
import { logger } from './logger';
import { DEFAULT_PORT, startServer } from './server';
import { initializeVerifierPool } from './signed-data-verifier-pool';

const setupUncaughtErrorHandler = () => {
  // NOTE: From the Node.js docs:
  //
  // Installing an 'uncaughtExceptionMonitor' listener does not change the behavior once an 'uncaughtException' event is
  // emitted. The process will still crash if no 'uncaughtException' listener is installed.
  process.on('uncaughtExceptionMonitor', (error, origin) => {
    logger.error('Uncaught exception.', error, { origin });
  });
};

const portSchema = z.coerce.number().int().positive();

// Start the Signed API. All application errors should be handled by this function (or its callees) and any error from
// this function is considered unexpected.
const startSignedApi = async () => {
  const goConfig = await go(loadAndCacheConfig);
  if (!goConfig.success) {
    logger.error('Failed to load the configuration.', goConfig.error);
    return;
  }
  const config = goConfig.data;
  logger.info('Using configuration.', config);

  const goPool = await go(() => initializeVerifierPool());
  if (!goPool.success) {
    logger.error('Failed to initialize verifier pool.', goPool.error);
    return;
  }
  const { maxWorkers, workerType } = goPool.data;
  logger.info('Initialized verifier pool.', { maxWorkers, workerType });

  const parsedPort = portSchema.safeParse(process.env.SERVER_PORT);
  let port: number;
  if (parsedPort.success) {
    port = parsedPort.data;
    logger.debug('Using SERVER_PORT environment variable as port number.', {
      port,
    });
  } else {
    port = DEFAULT_PORT;
    logger.debug('SERVER_PORT environment variable not set or invalid. Using default port.', {
      port,
    });
  }

  startServer(config, port);
};

const main = async () => {
  setupUncaughtErrorHandler();

  const goStartSignedApi = await go(startSignedApi);
  if (!goStartSignedApi.success) {
    logger.error('Could not start Signed API. Unexpected error occurred.', goStartSignedApi.error);
  }
};

void main();
