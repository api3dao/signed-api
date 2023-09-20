// Imports the source-map-support module and registers it to enable source map support in Node.js. This allows stack
// traces to show information from the original code, rather than the compiled JavaScript.
//
// You can check how this works by following the demo from https://github.com/evanw/node-source-map-support#demos. Just
// create a test script with/without the source map support, build the project and run the built script using node.
import 'source-map-support/register';

import { join } from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { loadConfig } from './validation/config';
import { initiateFetchingBeaconData } from './fetch-beacon-data';
import { initiateUpdatingSignedApi } from './update-signed-api';
import { initializeState } from './state';
import { initializeWallet } from './wallets';

export async function main() {
  const configPath = join(__dirname, '..', 'config');
  const secrets = dotenv.parse(readFileSync(join(configPath, 'secrets.env'), 'utf8'));
  const config = await loadConfig(join(configPath, 'pusher.json'), secrets);
  initializeState(config);

  initializeWallet();
  initiateFetchingBeaconData();
  initiateUpdatingSignedApi();
}

main();
