import { go } from '@api3/promise-utils';
import { ethers } from 'ethers';

import { logger } from '../logger';
import { getState } from '../state';
import { loadRawConfig } from '../validation/config';

import { heartbeatLogger } from './logger';

// Intentionally making the message as constant so that it is not accidentally changed. API integrations team (and maybe
// other teams, such as monitoring) will listen for this exact message to parse the heartbeat.
const HEARTBEAT_LOG_MESSAGE = 'Sending heartbeat log.';

export const initiateHeartbeat = () => {
  logger.debug('Initiating heartbeat loop.');
  setInterval(async () => {
    const goLogHeartbeat = await go(logHeartbeat);
    if (!goLogHeartbeat.success) logger.error('Failed to log heartbeat.', goLogHeartbeat.error);
  }, 1000 * 60); // Frequency is hardcoded to 1 minute.
};
export interface HeartbeatPayload {
  airnode: string;
  stage: string;
  nodeVersion: string;
  currentTimestamp: string;
  deploymentTimestamp: string;
  configHash: string;
  signature: string;
}

// We need to make sure the object is stringified in the same way every time, so we sort the keys alphabetically.
export const stringifyUnsignedHeartbeatPayload = (unsignedHeartbeatPayload: Omit<HeartbeatPayload, 'signature'>) =>
  JSON.stringify(unsignedHeartbeatPayload, Object.keys(unsignedHeartbeatPayload).sort());

export const signHeartbeat = async (
  airnodeWallet: ethers.Wallet,
  unsignedHeartbeatPayload: Omit<HeartbeatPayload, 'signature'>
) => {
  logger.debug('Signing heartbeat payload.');
  const messageToSign = ethers.utils.arrayify(createHash(stringifyUnsignedHeartbeatPayload(unsignedHeartbeatPayload)));
  return airnodeWallet.signMessage(messageToSign);
};

export const createHash = (value: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));

export const logHeartbeat = async () => {
  logger.debug('Creating heartbeat log.');

  const rawConfig = loadRawConfig(); // We want to log the raw config, not the one with interpolated secrets.
  const configHash = createHash(JSON.stringify(rawConfig));
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
