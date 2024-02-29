import { createSha256Hash } from '@api3/commons';
import { go } from '@api3/promise-utils';

import { logger } from '../logger';
import { getState } from '../state';
import { loadRawConfig } from '../validation/config';

import { HEARTBEAT_LOG_MESSAGE, type HeartbeatPayload, signHeartbeat } from './heartbeat-utils';
import { heartbeatLogger } from './logger';

export const initiateHeartbeatLoop = () => {
  logger.debug('Initiating heartbeat loop.');
  setInterval(async () => {
    const goLogHeartbeat = await go(logHeartbeat);
    if (!goLogHeartbeat.success) logger.error('Failed to log heartbeat.', goLogHeartbeat.error);
  }, 1000 * 60); // Frequency is hardcoded to 1 minute.
};

export const logHeartbeat = async () => {
  logger.debug('Creating heartbeat log.');

  const rawConfig = loadRawConfig(); // We want to log the raw config, not the one with interpolated secrets.
  const configHash = createSha256Hash(JSON.stringify(rawConfig));
  const {
    airnodeWallet,
    deploymentTimestamp,
    config: {
      nodeSettings: { stage, nodeVersion },
    },
  } = getState();

  logger.debug('Creating heartbeat payload.');
  const currentTimestamp = Math.floor(Date.now() / 1000).toString();
  const unsignedHeartbeatPayload = {
    airnode: airnodeWallet.address,
    stage,
    nodeVersion,
    currentTimestamp,
    deploymentTimestamp,
    configHash,
  };
  const signature = await signHeartbeat(airnodeWallet, unsignedHeartbeatPayload);
  const heartbeatPayload: HeartbeatPayload = { ...unsignedHeartbeatPayload, signature };

  // The logs are sent to API3 for validation (that the data provider deployed deployed the correct configuration) and
  // monitoring purposes (whether the instance is running).
  heartbeatLogger.info(HEARTBEAT_LOG_MESSAGE, heartbeatPayload);
};
