import { createLogger } from '@api3/commons/logger';

export const logger = createLogger({
  colorize: true,
  enabled: true,
  minLevel: 'debug',
  format: 'pretty',
});
