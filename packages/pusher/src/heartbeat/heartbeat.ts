import { go } from '@api3/promise-utils';
import { ethers } from 'ethers';

import { logger } from '../logger';
import { getState } from '../state';
import { loadRawConfig } from '../validation/config';

import { heartbeatLogger } from './logger';

export const initiateHeartbeat = () => {
  logger.debug('Initiating heartbeat loop');
  setInterval(async () => {
    const goLogHeartbeat = await go(logHeartbeat);
    if (!goLogHeartbeat.success) logger.error('Failed to log heartbeat', goLogHeartbeat.error);
  }, 1000 * 60); // Frequency is hardcoded to 1 minute.
};

export const signHeartbeat = async (airnodeWallet: ethers.Wallet, heartbeatPayload: unknown[]) => {
  logger.debug('Signing heartbeat payload');
  const signaturePayload = ethers.utils.arrayify(createHash(JSON.stringify(heartbeatPayload)));
  return airnodeWallet.signMessage(signaturePayload);
};

export const createHash = (value: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));

export const logHeartbeat = async () => {
  logger.debug('Creating heartbeat log');

  const rawConfig = loadRawConfig(); // We want to log the raw config, not the one with interpolated secrets.
  const rawConfigHash = createHash(JSON.stringify(rawConfig));
  const {
    airnodeWallet,
    deploymentTimestamp,
    config: {
      nodeSettings: { stage, nodeVersion },
    },
  } = getState();

  logger.debug('Creating heartbeat payload');
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const heartbeatPayload = [
    airnodeWallet.address,
    stage,
    nodeVersion,
    currentTimestamp.toString(),
    deploymentTimestamp.toString(),
    rawConfigHash,
  ];
  const heartbeatSignature = await signHeartbeat(airnodeWallet, heartbeatPayload);
  const heartbeatLog = [...heartbeatPayload, heartbeatSignature].join(' - ');

  // The logs are sent to API3 for validation (that the data provider deployed deployed the correct configuration) and
  // monitoring purposes (whether the instance is running).
  heartbeatLogger.info(heartbeatLog);
};
