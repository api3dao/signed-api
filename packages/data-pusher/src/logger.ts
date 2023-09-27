import { createLogger, logLevelSchema, LogConfig } from 'signed-api/common';

const logLevel = () => {
  const res = logLevelSchema.safeParse(process.env.LOG_LEVEL || 'info');
  return res.success ? res.data : 'info';
};

const options: LogConfig = {
  colorize: process.env.LOG_COLORIZE !== 'false',
  enabled: process.env.LOGGER_ENABLED !== 'false',
  minLevel: logLevel(),
  format: process.env.LOG_FORMAT === 'json' ? 'json' : 'pretty',
};

export const logger = createLogger(options);

