import { initiateFetchingBeaconData } from './fetch-beacon-data';
import { initiateHeartbeat } from './heartbeat';
import { initializeState } from './state';
import { initiateUpdatingSignedApi } from './update-signed-api';
import { loadConfig } from './validation/config';

const main = async () => {
  const config = await loadConfig();
  initializeState(config);

  initiateFetchingBeaconData();
  initiateUpdatingSignedApi();
  initiateHeartbeat();
};

void main();
