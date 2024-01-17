import z from 'zod';

import { fetchAndCacheConfig } from './config/config';
import { logger } from './logger';
import { DEFAULT_PORT, startServer } from './server';

const portSchema = z.coerce.number().int().positive();

const startDevServer = async () => {
  const config = await fetchAndCacheConfig();
  logger.info('Using configuration.', config);

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
