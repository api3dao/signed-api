import { COMMON_HEADERS } from './constants';
import { BatchSignedData, SignedData } from './schema';
import { ApiResponse } from './types';

export const isBatchUnique = (batchSignedData: BatchSignedData) => {
  return (
    batchSignedData.length ===
    new Set(batchSignedData.map(({ airnode, templateId }) => airnode.concat(templateId))).size
  );
};

export const isIgnored = (signedData: SignedData, ignoreAfterTimestamp: number) => {
  return parseInt(signedData.timestamp) > ignoreAfterTimestamp;
};

export const generateErrorResponse = (
  statusCode: number,
  message: string,
  detail?: string,
  extra?: unknown
): ApiResponse => {
  return { statusCode, headers: COMMON_HEADERS, body: JSON.stringify({ message, detail, extra }) };
};
