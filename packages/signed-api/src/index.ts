import { fetchAndCacheConfig } from './config/config';
import { logger } from './logger';
import { DEFAULT_PORT, startServer } from './server';
import { initializeVerifierPool } from './signed-data-verifier-pool';

const main = async () => {
  const config = await fetchAndCacheConfig();
  logger.info('Using configuration.', config);

  const pool = initializeVerifierPool();
  logger.info('Initialized verifier pool.', { maxWorkers: pool.maxWorkers, workerType: pool.workerType });

  startServer(config, DEFAULT_PORT);
};

void main();
