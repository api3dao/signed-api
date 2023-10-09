import { COMMON_HEADERS } from './constants';
import type { BatchSignedData, SignedData } from './schema';
import type { ApiResponse } from './types';

export const isBatchUnique = (batchSignedData: BatchSignedData) => {
  return (
    batchSignedData.length === new Set(batchSignedData.map(({ airnode, templateId }) => [...airnode, templateId])).size
  );
};

export const isIgnored = (signedData: SignedData, ignoreAfterTimestamp: number) => {
  return Number.parseInt(signedData.timestamp, 10) > ignoreAfterTimestamp;
};

export const generateErrorResponse = (
  statusCode: number,
  message: string,
  detail?: string,
  extra?: unknown
): ApiResponse => {
  return { statusCode, headers: COMMON_HEADERS, body: JSON.stringify({ message, detail, extra }) };
};
