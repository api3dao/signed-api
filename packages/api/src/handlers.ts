import { go, goSync } from '@api3/promise-utils';
import { isEmpty, isNil, omit } from 'lodash';

import { getConfig } from './config';
import { deriveBeaconId, recoverSignerAddress } from './evm';
import { createResponseHeaders } from './headers';
import { get, getAll, getAllAirnodeAddresses, prune, putAll } from './in-memory-cache';
import { logger } from './logger';
import { type SignedData, batchSignedDataSchema, evmAddressSchema } from './schema';
import type { ApiResponse } from './types';
import { generateErrorResponse, isBatchUnique } from './utils';

// Accepts a batch of signed data that is first validated for consistency and data integrity errors. If there is any
// issue during this step, the whole batch is rejected.
//
// Otherwise, each data is inserted to the storage even though they might already be more fresh data. This might be
// important for the delayed endpoint which may not be allowed to return the fresh data yet.
export const batchInsertData = async (requestBody: unknown): Promise<ApiResponse> => {
  const goValidateSchema = await go(async () => batchSignedDataSchema.parseAsync(requestBody));
  if (!goValidateSchema.success) {
    return generateErrorResponse(
      400,
      'Invalid request, body must fit schema for batch of signed data',
      goValidateSchema.error.message
    );
  }

  // Ensure that the batch of signed that comes from a whitelisted Airnode.
  const { endpoints, allowedAirnodes } = getConfig();
  if (
    allowedAirnodes !== '*' &&
    !goValidateSchema.data.every((signedData) => allowedAirnodes.includes(signedData.airnode))
  ) {
    return generateErrorResponse(403, 'Unauthorized Airnode address');
  }

  // Ensure there is at least one signed data to push
  const batchSignedData = goValidateSchema.data;
  if (isEmpty(batchSignedData)) return generateErrorResponse(400, 'No signed data to push');

  // Check whether any duplications exist
  if (!isBatchUnique(batchSignedData)) return generateErrorResponse(400, 'No duplications are allowed');

  // Check validations that can be done without using http request, returns fail response in first error
  const signedDataValidationResults = batchSignedData.map((signedData) => {
    // The on-chain contract prevents time drift by making sure the timestamp is at most 1 hour in the future. System
    // time drift is less common, but we mirror the contract implementation.
    if (Number.parseInt(signedData.timestamp, 10) > Math.floor(Date.now() / 1000) + 60 * 60) {
      return generateErrorResponse(400, 'Request timestamp is too far in the future', undefined, signedData);
    }

    const goRecoverSigner = goSync(() => recoverSignerAddress(signedData));
    if (!goRecoverSigner.success) {
      return generateErrorResponse(400, 'Unable to recover signer address', goRecoverSigner.error.message, signedData);
    }

    if (signedData.airnode !== goRecoverSigner.data) {
      return generateErrorResponse(400, 'Signature is invalid', undefined, signedData);
    }

    const goDeriveBeaconId = goSync(() => deriveBeaconId(signedData.airnode, signedData.templateId));
    if (!goDeriveBeaconId.success) {
      return generateErrorResponse(
        400,
        'Unable to derive beaconId by given airnode and templateId',
        goDeriveBeaconId.error.message,
        signedData
      );
    }

    if (signedData.beaconId !== goDeriveBeaconId.data) {
      return generateErrorResponse(400, 'beaconId is invalid', undefined, signedData);
    }

    return null;
  });
  const firstError = signedDataValidationResults.find(Boolean);
  if (firstError) return firstError;

  const newSignedData: SignedData[] = [];
  // Because pushers do not keep track of the last timestamp they pushed, they may push the same data twice, which
  // is acceptable, but we only want to store one data for each timestamp.
  for (const signedData of batchSignedData) {
    const requestTimestamp = Number.parseInt(signedData.timestamp, 10);
    const goReadDb = await go(async () => get(signedData.airnode, signedData.templateId, requestTimestamp));
    if (goReadDb.data && requestTimestamp === Number.parseInt(goReadDb.data.timestamp, 10)) {
      logger.debug('Skipping signed data because signed data with the same timestamp already exists', { signedData });
      continue;
    }

    newSignedData.push(signedData);
  }

  // Write batch of validated data to the database
  const goBatchWriteDb = await go(async () => putAll(newSignedData));
  if (!goBatchWriteDb.success) {
    return generateErrorResponse(500, 'Unable to send batch of signed data to database', goBatchWriteDb.error.message);
  }

  // Prune the cache with the data that is too old (no endpoint will ever return it)
  const maxDelay = endpoints.reduce((acc, endpoint) => Math.max(acc, endpoint.delaySeconds), 0);
  const maxIgnoreAfterTimestamp = Math.floor(Date.now() / 1000 - maxDelay);
  const goPruneCache = await go(async () => prune(newSignedData, maxIgnoreAfterTimestamp));
  if (!goPruneCache.success) {
    return generateErrorResponse(500, 'Unable to remove outdated cache data', goPruneCache.error.message);
  }

  return {
    statusCode: 201,
    headers: createResponseHeaders(getConfig().cache),
    body: JSON.stringify({
      count: newSignedData.length,
      skipped: batchSignedData.length - newSignedData.length,
    }),
  };
};

// Returns the most fresh signed data for each templateId for the given airnode address. The API can be delayed, which
// filter out all signed data that happend in the specified "delaySeconds" parameter (essentially, such signed data is
// treated as non-existant).
export const getData = async (airnodeAddress: string, delaySeconds: number): Promise<ApiResponse> => {
  if (isNil(airnodeAddress)) return generateErrorResponse(400, 'Invalid request, airnode address is missing');

  const goValidateSchema = await go(async () => evmAddressSchema.parseAsync(airnodeAddress));
  if (!goValidateSchema.success) {
    return generateErrorResponse(400, 'Invalid request, airnode address must be an EVM address');
  }

  const { allowedAirnodes } = getConfig();
  if (allowedAirnodes !== '*' && !allowedAirnodes.includes(airnodeAddress)) {
    return generateErrorResponse(403, 'Unauthorized Airnode address');
  }

  const ignoreAfterTimestamp = Math.floor(Date.now() / 1000 - delaySeconds);
  const goReadDb = await go(async () => getAll(airnodeAddress, ignoreAfterTimestamp));
  if (!goReadDb.success) {
    return generateErrorResponse(500, 'Unable to get signed data from database', goReadDb.error.message);
  }

  const data = goReadDb.data.reduce((acc, signedData) => {
    return { ...acc, [signedData.beaconId]: omit(signedData, 'beaconId') };
  }, {});

  return {
    statusCode: 200,
    headers: createResponseHeaders(getConfig().cache),
    body: JSON.stringify({ count: goReadDb.data.length, data }),
  };
};

// Returns all airnode addresses for which there is data. Note, that the delayed endpoint may not be allowed to show it.
// We do not return the allowed Airnode addresses in the configuration, because the value can be set to "*" and we
// would have to scan the database anyway.
export const listAirnodeAddresses = async (): Promise<ApiResponse> => {
  const goAirnodeAddresses = await go(async () => getAllAirnodeAddresses());
  if (!goAirnodeAddresses.success) {
    return generateErrorResponse(500, 'Unable to scan database', goAirnodeAddresses.error.message);
  }
  const airnodeAddresses = goAirnodeAddresses.data;

  return {
    statusCode: 200,
    headers: createResponseHeaders(getConfig().cache),
    body: JSON.stringify({ count: airnodeAddresses.length, 'available-airnodes': airnodeAddresses }),
  };
};
