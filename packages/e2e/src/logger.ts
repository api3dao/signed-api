import { createLogger } from '@api3/commons/dist/logger';

export const logger = createLogger({
  colorize: true,
  enabled: true,
  minLevel: 'debug',
  format: 'pretty',
});
