import { fetchAndCacheConfig } from './config';
import { logger } from './logger';
import { startServer } from './server';

const main = async () => {
  const config = await fetchAndCacheConfig();
  logger.info('Using configuration', config);

  startServer(config);
};

void main();
