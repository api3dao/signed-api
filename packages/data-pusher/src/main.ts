import * as path from 'path';
import { loadConfig } from './validation/config';
import { initiateFetchingBeaconData } from './fetch-beacon-data';
import { initiateUpdatingSignedApi } from './update-signed-api';
import { initializeState } from './state';
import { initializeWallet } from './wallets';

export async function main() {
  // TODO: How should the config be called?
  const config = await loadConfig(path.join(__dirname, '..', 'config', 'pusher.json'), process.env);
  initializeState(config);

  initializeWallet();
  await Promise.all([initiateFetchingBeaconData(), initiateUpdatingSignedApi()]);
}
