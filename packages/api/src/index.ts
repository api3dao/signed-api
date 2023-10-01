import { startServer } from './server';
import { logger } from './logger';
import { fetchAndCacheConfig } from './config';

async function main() {
  const config = await fetchAndCacheConfig();
  logger.info('Using configuration', config);

  startServer(config);
}

main();
