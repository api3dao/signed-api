import { createSha256Hash, serializePlainObject } from '@api3/commons';
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

export const signHeartbeat = async (
  airnodeWallet: ethers.Wallet,
  unsignedHeartbeatPayload: Omit<HeartbeatPayload, 'signature'>
) => {
  logger.debug('Signing heartbeat payload.');
  const messageToSign = ethers.utils.arrayify(createSha256Hash(serializePlainObject(unsignedHeartbeatPayload)));
  return airnodeWallet.signMessage(messageToSign);
};
