import { isEmpty, isNil, omit, size } from 'lodash';
import { go, goSync } from '@api3/promise-utils';
import {
  ApiRequest,
  ApiResponse,
  PromiseError,
  batchSignedDataSchema,
  evmAddressSchema,
  signedDataSchema,
} from './types';
import { deriveBeaconId, recoverSignerAddress } from './evm';
import { generateErrorResponse, isBatchUnique } from './utils';
import { CACHE_HEADERS, COMMON_HEADERS, MAX_BATCH_SIZE } from './constants';
import { getAll, getAllBy, getBy, put, putAll } from './in-memory-cache';

export const upsertData = async (request: ApiRequest): Promise<ApiResponse> => {
  if (isNil(request.body)) return generateErrorResponse(400, 'Invalid request, http body is missing');

  const goJsonParseBody = goSync(() => JSON.parse(request.body));
  if (!goJsonParseBody.success) return generateErrorResponse(400, 'Invalid request, body must be in JSON');

  const goValidateSchema = await go(() => signedDataSchema.parseAsync(goJsonParseBody.data));
  if (!goValidateSchema.success)
    return generateErrorResponse(
      400,
      'Invalid request, body must fit schema for signed data',
      goValidateSchema.error.message
    );

  const signedData = goValidateSchema.data;

  const goRecoverSigner = goSync(() => recoverSignerAddress(signedData));
  if (!goRecoverSigner.success)
    return generateErrorResponse(400, 'Unable to recover signer address', goRecoverSigner.error.message);

  if (signedData.airnode !== goRecoverSigner.data) return generateErrorResponse(400, 'Signature is invalid');

  const goDeriveBeaconId = goSync(() => deriveBeaconId(signedData.airnode, signedData.templateId));
  if (!goDeriveBeaconId.success)
    return generateErrorResponse(
      400,
      'Unable to derive beaconId by given airnode and templateId',
      goDeriveBeaconId.error.message
    );

  if (signedData.beaconId !== goDeriveBeaconId.data) return generateErrorResponse(400, 'beaconId is invalid');

  const goReadDb = await go(() => getBy(signedData.airnode, signedData.templateId));
  if (!goReadDb.success)
    return generateErrorResponse(
      500,
      'Unable to get signed data from database to validate timestamp',
      goReadDb.error.message
    );

  if (!isNil(goReadDb.data) && parseInt(signedData.timestamp) <= parseInt(goReadDb.data.timestamp))
    return generateErrorResponse(400, "Request isn't updating the timestamp");

  const goWriteDb = await go(() => put(signedData));
  if (!goWriteDb.success)
    return generateErrorResponse(500, 'Unable to send signed data to database', goWriteDb.error.message);

  return { statusCode: 201, headers: COMMON_HEADERS, body: JSON.stringify({ count: 1 }) };
};

export const batchUpsertData = async (request: ApiRequest): Promise<ApiResponse> => {
  if (isNil(request.body)) return generateErrorResponse(400, 'Invalid request, http body is missing');

  const goJsonParseBody = goSync(() => JSON.parse(request.body));
  if (!goJsonParseBody.success) return generateErrorResponse(400, 'Invalid request, body must be in JSON');

  const goValidateSchema = await go(() => batchSignedDataSchema.parseAsync(goJsonParseBody.data));
  if (!goValidateSchema.success)
    return generateErrorResponse(
      400,
      'Invalid request, body must fit schema for batch of signed data',
      goValidateSchema.error.message
    );

  const batchSignedData = goValidateSchema.data;

  /*
    The following validations behave similarly to Promise.all.
    If any of the validations fail, the entire batch will be dropped.
    This approach ensures consistent processing of the batch,
    preventing partial or inconsistent results.
  */

  // Phase 1: Check whether batch is empty
  if (isEmpty(batchSignedData)) return generateErrorResponse(400, 'No signed data to push');

  // Phase 2: Check whether the size of batch exceeds a maximum batch size
  if (size(batchSignedData) > MAX_BATCH_SIZE)
    return generateErrorResponse(400, `Maximum batch size (${MAX_BATCH_SIZE}) exceeded`);

  // Phase 3: Check whether any duplications exist
  if (!isBatchUnique(batchSignedData)) return generateErrorResponse(400, 'No duplications are allowed');

  // Phase 4: Check validations that can be done without using http request, returns fail response in first error
  const phase4Promises = batchSignedData.map(async (signedData) => {
    const goRecoverSigner = goSync(() => recoverSignerAddress(signedData));
    if (!goRecoverSigner.success)
      return Promise.reject(
        generateErrorResponse(400, 'Unable to recover signer address', goRecoverSigner.error.message, signedData)
      );

    if (signedData.airnode !== goRecoverSigner.data)
      return Promise.reject(generateErrorResponse(400, 'Signature is invalid', undefined, signedData));

    const goDeriveBeaconId = goSync(() => deriveBeaconId(signedData.airnode, signedData.templateId));
    if (!goDeriveBeaconId.success)
      return Promise.reject(
        generateErrorResponse(
          400,
          'Unable to derive beaconId by given airnode and templateId',
          goDeriveBeaconId.error.message,
          signedData
        )
      );

    if (signedData.beaconId !== goDeriveBeaconId.data)
      return Promise.reject(generateErrorResponse(400, 'beaconId is invalid', undefined, signedData));
  });

  const goPhase4Results = await go<any, PromiseError<ApiResponse>>(() => Promise.all(phase4Promises));
  if (!goPhase4Results.success) return goPhase4Results.error.reason;

  // Phase 5: Get current signed data to compare timestamp, returns fail response in first error
  const phase5Promises = batchSignedData.map(async (signedData) => {
    const goReadDb = await go(() => getBy(signedData.airnode, signedData.templateId));
    if (!goReadDb.success)
      return Promise.reject(
        generateErrorResponse(
          500,
          'Unable to get signed data from database to validate timestamp',
          goReadDb.error.message,
          signedData
        )
      );

    if (!isNil(goReadDb.data) && parseInt(signedData.timestamp) <= parseInt(goReadDb.data.timestamp))
      return Promise.reject(generateErrorResponse(400, "Request isn't updating the timestamp", undefined, signedData));
  });

  const goPhase5Results = await go<any, PromiseError<ApiResponse>>(() => Promise.all(phase5Promises));
  if (!goPhase5Results.success) return goPhase5Results.error.reason;

  // Phase 6: Write batch of validated data to the database
  const goBatchWriteDb = await go(() => putAll(batchSignedData));
  if (!goBatchWriteDb.success)
    return generateErrorResponse(500, 'Unable to send batch of signed data to database', goBatchWriteDb.error.message);

  return { statusCode: 201, headers: COMMON_HEADERS, body: JSON.stringify({ count: batchSignedData.length }) };
};

export const getData = async (request: ApiRequest): Promise<ApiResponse> => {
  if (isNil(request.queryParams.airnode))
    return generateErrorResponse(400, 'Invalid request, path parameter airnode address is missing');

  const goValidateSchema = await go(() => evmAddressSchema.parseAsync(request.queryParams.airnode));
  if (!goValidateSchema.success)
    return generateErrorResponse(400, 'Invalid request, path parameter must be an EVM address');

  const goReadDb = await go(() => getAllBy(request.queryParams.airnode));
  if (!goReadDb.success)
    return generateErrorResponse(500, 'Unable to get signed data from database', goReadDb.error.message);

  // Transform array of signed data to be in form {[beaconId]: SignedData}
  const data = goReadDb.data.reduce((acc, Item) => ({ ...acc, [Item.beaconId]: omit(Item, 'beaconId') }), {});

  return {
    statusCode: 200,
    headers: { ...COMMON_HEADERS, ...CACHE_HEADERS },
    body: JSON.stringify({ count: goReadDb.data.length, data }),
  };
};

export const listAirnodeAddresses = async (_request: ApiRequest): Promise<ApiResponse> => {
  const goScanDb = await go(() => getAll());
  if (!goScanDb.success) return generateErrorResponse(500, 'Unable to scan database', goScanDb.error.message);

  const airnodeAddresses = Object.keys(goScanDb.data);

  return {
    statusCode: 200,
    headers: { ...COMMON_HEADERS, ...CACHE_HEADERS, 'cdn-cache-control': 'max-age=300' },
    body: JSON.stringify({ count: airnodeAddresses.length, 'available-airnodes': airnodeAddresses }),
  };
};
