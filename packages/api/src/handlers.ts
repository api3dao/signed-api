import { go, goSync } from '@api3/promise-utils';
import { isEmpty, isNil, omit, size } from 'lodash';
import { CACHE_HEADERS, COMMON_HEADERS } from './constants';
import { deriveBeaconId, recoverSignerAddress } from './evm';
import { getAll, getAllAirnodeAddresses, prune, putAll } from './in-memory-cache';
import { ApiResponse } from './types';
import { generateErrorResponse, getConfig, isBatchUnique } from './utils';
import { batchSignedDataSchema, evmAddressSchema } from './schema';

// Accepts a batch of signed data that is first validated for consistency and data integrity errors. If there is any
// issue during this step, the whole batch is rejected.
//
// Otherwise, each data is inserted to the storage even though they might already be more fresh data. This might be
// important for the delayed endpoint which may not be allowed to return the fresh data yet.
export const batchInsertData = async (requestBody: unknown): Promise<ApiResponse> => {
  const goValidateSchema = await go(() => batchSignedDataSchema.parseAsync(requestBody));
  if (!goValidateSchema.success)
    return generateErrorResponse(
      400,
      'Invalid request, body must fit schema for batch of signed data',
      goValidateSchema.error.message
    );

  // Ensure there is at least one signed data to push
  const batchSignedData = goValidateSchema.data;
  if (isEmpty(batchSignedData)) return generateErrorResponse(400, 'No signed data to push');

  // Check whether the size of batch exceeds a maximum batch size
  const { maxBatchSize, endpoints } = getConfig();
  if (size(batchSignedData) > maxBatchSize)
    return generateErrorResponse(400, `Maximum batch size (${maxBatchSize}) exceeded`);

  // Check whether any duplications exist
  if (!isBatchUnique(batchSignedData)) return generateErrorResponse(400, 'No duplications are allowed');

  // Check validations that can be done without using http request, returns fail response in first error
  const signedDataValidationResults = batchSignedData.map((signedData) => {
    const goRecoverSigner = goSync(() => recoverSignerAddress(signedData));
    if (!goRecoverSigner.success)
      return generateErrorResponse(400, 'Unable to recover signer address', goRecoverSigner.error.message, signedData);

    if (signedData.airnode !== goRecoverSigner.data)
      return generateErrorResponse(400, 'Signature is invalid', undefined, signedData);

    const goDeriveBeaconId = goSync(() => deriveBeaconId(signedData.airnode, signedData.templateId));
    if (!goDeriveBeaconId.success)
      return generateErrorResponse(
        400,
        'Unable to derive beaconId by given airnode and templateId',
        goDeriveBeaconId.error.message,
        signedData
      );

    if (signedData.beaconId !== goDeriveBeaconId.data)
      return generateErrorResponse(400, 'beaconId is invalid', undefined, signedData);

    return null;
  });
  const firstError = signedDataValidationResults.find(Boolean);
  if (firstError) return firstError;

  // Write batch of validated data to the database
  const goBatchWriteDb = await go(() => putAll(batchSignedData));
  if (!goBatchWriteDb.success)
    return generateErrorResponse(500, 'Unable to send batch of signed data to database', goBatchWriteDb.error.message);

  // Prune the cache with the data that is too old (no endpoint will ever return it)
  const maxDelay = endpoints.reduce((acc, endpoint) => Math.max(acc, endpoint.delaySeconds), 0);
  const maxIgnoreAfterTimestamp = Math.floor(Date.now() / 1000 - maxDelay);
  const goPruneCache = await go(() => prune(batchSignedData, maxIgnoreAfterTimestamp));
  if (!goPruneCache.success)
    return generateErrorResponse(500, 'Unable to remove outdated cache data', goPruneCache.error.message);

  return { statusCode: 201, headers: COMMON_HEADERS, body: JSON.stringify({ count: batchSignedData.length }) };
};

// Returns the most fresh signed data for each templateId for the given airnode address. The API can be delayed, which
// filter out all signed data that happend in the specified "delaySeconds" parameter (essentially, such signed data is
// treated as non-existant).
export const getData = async (airnodeAddress: string, delaySeconds: number): Promise<ApiResponse> => {
  if (isNil(airnodeAddress)) return generateErrorResponse(400, 'Invalid request, airnode address is missing');

  const goValidateSchema = await go(() => evmAddressSchema.parseAsync(airnodeAddress));
  if (!goValidateSchema.success)
    return generateErrorResponse(400, 'Invalid request, airnode address must be an EVM address');

  const ignoreAfterTimestamp = Math.floor(Date.now() / 1000 - delaySeconds);
  const goReadDb = await go(() => getAll(airnodeAddress, ignoreAfterTimestamp));
  if (!goReadDb.success)
    return generateErrorResponse(500, 'Unable to get signed data from database', goReadDb.error.message);

  const data = goReadDb.data.reduce((acc, signedData) => {
    return { ...acc, [signedData.beaconId]: omit(signedData, 'beaconId') };
  }, {});

  return {
    statusCode: 200,
    headers: { ...COMMON_HEADERS, ...CACHE_HEADERS },
    body: JSON.stringify({ count: goReadDb.data.length, data }),
  };
};

// Returns all airnode addresses for which there is data. Note, that the delayed endpoint may not be allowed to show
// it.
export const listAirnodeAddresses = async (): Promise<ApiResponse> => {
  const goAirnodeAddresses = await go(() => getAllAirnodeAddresses());
  if (!goAirnodeAddresses.success)
    return generateErrorResponse(500, 'Unable to scan database', goAirnodeAddresses.error.message);
  const airnodeAddresses = goAirnodeAddresses.data;

  return {
    statusCode: 200,
    headers: { ...COMMON_HEADERS, ...CACHE_HEADERS, 'cdn-cache-control': `max-age=${getConfig().cache.maxAgeSeconds}` },
    body: JSON.stringify({ count: airnodeAddresses.length, 'available-airnodes': airnodeAddresses }),
  };
};
