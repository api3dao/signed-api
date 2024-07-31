import { type SignedData } from '@api3/airnode-feed';
import { ethers } from 'ethers';

import { createResponseHeaders } from './headers';
import type { ApiResponse } from './types';

export const isBatchUnique = (batchSignedData: SignedData[]) => {
  return batchSignedData.length === new Set(batchSignedData.map(({ templateId }) => templateId)).size;
};

export const isIgnored = (signedData: SignedData, ignoreAfterTimestamp: number) => {
  return Number.parseInt(signedData.timestamp, 10) > ignoreAfterTimestamp;
};

export const generateErrorResponse = (
  statusCode: number,
  message: string,
  context?: Record<string, unknown>
): ApiResponse => {
  return {
    statusCode,
    headers: createResponseHeaders(),
    body: JSON.stringify(context ? { message, context } : { message }),
  };
};

export const extractBearerToken = (authorizationHeader: string | undefined) => {
  if (!authorizationHeader) return null;

  const [type, token] = authorizationHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;

  return token;
};

export const decodeData = (data: string) => ethers.utils.defaultAbiCoder.decode(['int256'], data);

const packAndHashWithTemplateId = (templateId: string, timestamp: string, data: string) =>
  ethers.utils.arrayify(
    ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes32', 'uint256', 'bytes'], [templateId, timestamp, data || '0x'])
    )
  );

export const deriveBeaconId = (airnode: string, templateId: string) =>
  ethers.utils.keccak256(ethers.utils.solidityPack(['address', 'bytes32'], [airnode, templateId]));

export const recoverSignerAddress = (data: SignedData): string => {
  const digest = packAndHashWithTemplateId(data.templateId, data.timestamp, data.encodedValue);
  return ethers.utils.verifyMessage(digest, data.signature);
};
