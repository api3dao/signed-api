import { loadConfig } from './validation/config';
import { initiateFetchingBeaconData } from './fetch-beacon-data';
import { initiateUpdatingSignedApi } from './update-signed-api';
import { initializeState } from './state';

async function main() {
  const config = await loadConfig();
  initializeState(config);

  initiateFetchingBeaconData();
  initiateUpdatingSignedApi();
}

main();
