import { createResponseHeaders } from './headers';
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
