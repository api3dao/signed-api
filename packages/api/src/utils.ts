import { APIGatewayProxyResult } from 'aws-lambda';
import { BatchSignedData, SignedData } from './types';
import { COMMON_HEADERS } from './constants';

export const isBatchUnique = (batchSignedData: BatchSignedData) =>
  batchSignedData.length === new Set(batchSignedData.map(({ airnode, templateId }) => airnode.concat(templateId))).size;

export const generateErrorResponse = (
  statusCode: number,
  message: string,
  detail?: string,
  causing?: SignedData
): APIGatewayProxyResult => {
  return { statusCode, headers: COMMON_HEADERS, body: JSON.stringify({ message, detail, causing }) };
};
