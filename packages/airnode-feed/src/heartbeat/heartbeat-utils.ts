import { ethers } from 'ethers';

import { logger } from '../logger';

// Intentionally making the message as constant so that it is not accidentally changed. API integrations team (and maybe
// other teams, such as monitoring) will listen for this exact message to parse the heartbeat.
export const HEARTBEAT_LOG_MESSAGE = 'Sending heartbeat log.';

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
  const messageToSign = ethers.utils.arrayify(
    createConfigHash(stringifyUnsignedHeartbeatPayload(unsignedHeartbeatPayload))
  );
  return airnodeWallet.signMessage(messageToSign);
};

export const createConfigHash = (value: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
