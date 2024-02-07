import z from 'zod';

import { fetchAndCacheConfig } from './config/config';
import { logger } from './logger';
import { DEFAULT_PORT, startServer } from './server';
import { initializeVerifierPool } from './signed-data-verifier-pool';

const portSchema = z.coerce.number().int().positive();

const startDevServer = async () => {
  const config = await fetchAndCacheConfig();
  logger.info('Using configuration.', config);

  const pool = initializeVerifierPool();
  logger.info('Initialized verifier pool.', { maxWorkers: pool.maxWorkers, workerType: pool.workerType });

  const parsedPort = portSchema.safeParse(process.env.DEV_SERVER_PORT);
  let port: number;
  if (parsedPort.success) {
    port = parsedPort.data;
    logger.debug('Using DEV_SERVER_PORT environment variable as port number.', {
      port,
    });
  } else {
    port = DEFAULT_PORT;
    logger.debug('DEV_SERVER_PORT environment variable not set or invalid. Using default port.', {
      port,
    });
  }

  startServer(config, port);
};

void startDevServer();
