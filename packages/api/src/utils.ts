import { readFileSync } from 'fs';
import { join } from 'path';
import { ApiResponse } from './types';
import { COMMON_HEADERS } from './constants';
import { BatchSignedData, SignedData, configSchema } from './schema';

export const isBatchUnique = (batchSignedData: BatchSignedData) =>
  batchSignedData.length === new Set(batchSignedData.map(({ airnode, templateId }) => airnode.concat(templateId))).size;

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

export const getConfig = () =>
  configSchema.parse(JSON.parse(readFileSync(join(__dirname, '../config/signed-api.json'), 'utf8')));
