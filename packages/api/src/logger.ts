import { createLogger, Logger } from 'signed-api/common';
import { getConfig } from './utils';

let logger: Logger | undefined;

export const initializeLogger = () => {
  const config = getConfig();
  logger = createLogger(config.logger);
};

export const getLogger = () => {
  if (!logger) throw new Error('Logger not initialized');

  return logger;
};
