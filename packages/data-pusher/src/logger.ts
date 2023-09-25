import { Logger, createLogger } from 'signed-api/common';
import { Config } from './validation/schema';

let logger: Logger | undefined;

export const initializeLogger = (config: Config) => {
  logger = createLogger(config.logger);
  return logger;
};

export const getLogger = () => {
  if (!logger) throw new Error('Logger not initialized');

  return logger;
};
