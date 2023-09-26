// Imports the source-map-support module and registers it to enable source map support in Node.js. This allows stack
// traces to show information from the original code, rather than the compiled JavaScript.
//
// You can check how this works by following the demo from https://github.com/evanw/node-source-map-support#demos. Just
// create a test script with/without the source map support, build the project and run the built script using node.
import 'source-map-support/register';
import dotenv from 'dotenv';
import { startServer } from './server';
import { getAndParseConfig } from './utils';
import { logger } from './logger';
import { Config } from './schema';

dotenv.config();

// Fetch the config before starting the application
getAndParseConfig().then((config: Config) => {
  logger.info('Using configuration', config);
  startServer(config);
});
