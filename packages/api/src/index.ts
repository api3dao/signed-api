// Imports the source-map-support module and registers it to enable source map support in Node.js. This allows stack
// traces to show information from the original code, rather than the compiled JavaScript.
//
// You can check how this works by following the demo from https://github.com/evanw/node-source-map-support#demos. Just
// create a test script with/without the source map support, build the project and run the built script using node.
import 'source-map-support/register';
import { startServer } from './server';
import { logger } from './logger';
import { fetchAndCacheConfig } from './config';

async function main() {
  const config = await fetchAndCacheConfig();
  logger.info('Using configuration', config);

  startServer(config);
}

main();
