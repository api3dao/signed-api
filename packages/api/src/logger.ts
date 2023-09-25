import { createLogger } from 'signed-api/common';
import { getConfig } from './utils';

const config = getConfig();
export const logger = createLogger(config.logger);
