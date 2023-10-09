import { createLogger, logConfigSchema } from 'signed-api/common';

import { loadEnv } from './env';

// We need to load the environment variables before we can use the logger. Because we want the logger to always be
// available, we load the environment variables as a side effect during the module import.
const env = loadEnv();

const options = logConfigSchema.parse({
  colorize: env.LOG_COLORIZE,
  enabled: env.LOGGER_ENABLED,
  minLevel: env.LOG_LEVEL,
  format: env.LOG_FORMAT,
});

export const logger = createLogger(options);
