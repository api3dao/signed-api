import { fetchAndCacheConfig } from './config';
import { logger } from './logger';
import { DEFAULT_PORT, startServer } from './server';

const main = async () => {
  const config = await fetchAndCacheConfig();
  logger.info('Using configuration', config);

  startServer(config, DEFAULT_PORT);
};

void main();
