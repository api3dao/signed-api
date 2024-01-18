import { initiateSignedApiUpdateLoops } from './fetch-beacon-data';
import { initiateHeartbeatLoop } from './heartbeat';
import { initializeState } from './state';
import { loadConfig } from './validation/config';

const main = async () => {
  const config = await loadConfig();
  initializeState(config);

  void initiateSignedApiUpdateLoops();
  initiateHeartbeatLoop();
};

void main();
