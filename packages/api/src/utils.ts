import { ApiResponse, BatchSignedData, SignedData } from './types';
import { COMMON_HEADERS } from './constants';

export const isBatchUnique = (batchSignedData: BatchSignedData) =>
  batchSignedData.length === new Set(batchSignedData.map(({ airnode, templateId }) => airnode.concat(templateId))).size;

export const generateErrorResponse = (
  statusCode: number,
  message: string,
  detail?: string,
  // TODO: This is a bit weird in the context of a generic error response
  causing?: SignedData
): ApiResponse => {
  return { statusCode, headers: COMMON_HEADERS, body: JSON.stringify({ message, detail, causing }) };
};
