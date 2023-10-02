import { createLogger } from 'signed-api/common';

export const logger = createLogger({
  colorize: true,
  enabled: true,
  minLevel: 'debug',
  format: 'pretty',
});
