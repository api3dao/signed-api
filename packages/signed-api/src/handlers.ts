import { signedApiBatchPayloadV1Schema, signedApiBatchPayloadV2Schema } from '@api3/airnode-feed';
import { createSha256Hash, serializePlainObject } from '@api3/commons';
import { go, goSync } from '@api3/promise-utils';
import { isEmpty, omit, pick } from 'lodash';

import { getConfig } from './config/config';
import { loadEnv } from './env';
import { createResponseHeaders } from './headers';
import { get, getAll, getAllAirnodeAddresses, prune, putAll } from './in-memory-cache';
import { logger } from './logger';
import { type Endpoint, evmAddressSchema } from './schema';
import { getVerifier } from './signed-data-verifier-pool';
import { transformAirnodeFeedPayload } from './transform-payload';
import type {
  ApiResponse,
  GetAirnodesResponseSchema,
  GetSignedDataResponseSchema,
  GetUnsignedDataResponseSchema,
  InternalSignedData,
  PostSignedDataResponseSchema,
  GetStatusResponseSchema,
} from './types';
import { extractBearerToken, generateErrorResponse, isBatchUnique } from './utils';

// Initialize deployment timestamp when the application starts
const DEPLOYMENT_TIMESTAMP = Math.floor(Date.now() / 1000).toString();

// Accepts a batch of signed data that is first validated for consistency and data integrity errors. If there is any
// issue during this step, the whole batch is rejected.
//
// Otherwise, each data is inserted to the storage even though they might already be more fresh data. This might be
// important for the delayed endpoint which may not be allowed to return the fresh data yet.
export const batchInsertData = async (
  authorizationHeader: string | undefined,
  rawRequestBody: unknown,
  rawAirnodeAddress: string
): Promise<ApiResponse> => {
  // Make sure the Airnode address is valid.
  const goAirnodeAddresses = goSync(() => evmAddressSchema.parse(rawAirnodeAddress));
  if (!goAirnodeAddresses.success) {
    return generateErrorResponse(400, 'Invalid request, airnode address must be an EVM address');
  }
  const airnodeAddress = goAirnodeAddresses.data;

  // Ensure that the batch of signed that comes from a whitelisted Airnode.
  const { endpoints, allowedAirnodes } = getConfig();
  if (allowedAirnodes !== '*') {
    // Find the allowed airnode and extract the request token.
    const allowedAirnode = allowedAirnodes.find((allowedAirnode) => allowedAirnode.address === airnodeAddress);
    const authToken = extractBearerToken(authorizationHeader);

    // Check if the airnode is allowed and if the auth token is valid.
    const isAirnodeAllowed = Boolean(allowedAirnode);
    const isAuthTokenValid = allowedAirnode?.authTokens === null || allowedAirnode?.authTokens.includes(authToken!);
    if (!isAirnodeAllowed || !isAuthTokenValid) {
      if (isAirnodeAllowed) {
        logger.debug(`Invalid auth token`, { allowedAirnode, authToken });
      }
      return generateErrorResponse(403, 'Unauthorized Airnode address', { airnodeAddress });
    }
  }

  // Parse the request body. Try parsing v2 schema first and fallback to v1 if validation fails.
  const v2ParsingResult = await signedApiBatchPayloadV2Schema.safeParseAsync(rawRequestBody);
  const v1ParsingResult = v2ParsingResult.success
    ? undefined
    : await signedApiBatchPayloadV1Schema.safeParseAsync(rawRequestBody);
  if (!v2ParsingResult.success && v1ParsingResult && !v1ParsingResult.success) {
    return generateErrorResponse(400, 'Invalid request, body must fit schema for batch of signed data', {
      v1ParsingIssues: v1ParsingResult.error.issues,
      v2ParsingIssues: v2ParsingResult.error.issues,
    });
  }

  // Create the batched signed data from the Airnode feed payload.
  const batchSignedData = transformAirnodeFeedPayload(
    v2ParsingResult.success ? v2ParsingResult.data : v1ParsingResult!.data!
  );

  // Ensure there is at least one signed data to push.
  if (isEmpty(batchSignedData)) return generateErrorResponse(400, 'No signed data to push');

  // Check if all signed data is from the same airnode.
  const signedDataAirnodes = new Set(batchSignedData.map((signedData) => signedData.airnode));
  if (signedDataAirnodes.size > 1) {
    return generateErrorResponse(400, 'All signed data must be from the same Airnode address', {
      airnodeAddresses: [...signedDataAirnodes],
    });
  }

  // Check if the path parameter matches the airnode address in the signed data.
  if (airnodeAddress !== batchSignedData[0]!.airnode) {
    return generateErrorResponse(400, 'Airnode address in the path parameter does not match one in the signed data', {
      airnodeAddress,
      signedData: batchSignedData[0],
    });
  }

  // Check whether any duplications exist (based on the beacon ID).
  if (!isBatchUnique(batchSignedData)) return generateErrorResponse(400, 'No duplications are allowed');

  const goVerificationResult = await go(async () => {
    const verifier = await getVerifier();
    return verifier.verifySignedData(batchSignedData);
  });
  if (!goVerificationResult.success) {
    return generateErrorResponse(500, 'Unable to verify signed data', { detail: goVerificationResult.error.message });
  }
  if (goVerificationResult.data !== null) {
    const { message, signedData, detail } = goVerificationResult.data;
    return generateErrorResponse(400, message, detail ? { detail, signedData } : { signedData });
  }

  const env = loadEnv();
  if (env.LOG_API_DATA) {
    // Log only the required fields to use less space, do not log the signature for security reasons.
    const sanitizedData = batchSignedData.map((data) =>
      pick(data, ['airnode', 'encodedValue', 'templateId', 'timestamp'])
    );
    logger.info('Received valid signed data.', { data: sanitizedData });
  }

  const newSignedData: InternalSignedData[] = [];
  // Because Airnode feed does not keep track of the last timestamp they pushed, it may push the same data twice, which
  // is acceptable, but we only want to store one data for each timestamp.
  for (const signedData of batchSignedData) {
    const requestTimestamp = Number.parseInt(signedData.timestamp, 10);
    const cachedValue = get(signedData.airnode, signedData.templateId, requestTimestamp);
    if (cachedValue && requestTimestamp === Number.parseInt(cachedValue.timestamp, 10)) {
      continue; // Intentionally not logging a message here, because this is a common case and it would be too noisy.
    }

    newSignedData.push(signedData);
  }

  // Write batch of validated data to the cache.
  putAll(newSignedData);

  // Prune the cache with the data that is too old (no endpoint will ever return it).
  const maxDelay = endpoints.reduce((acc, endpoint) => Math.max(acc, endpoint.delaySeconds), 0);
  const maxIgnoreAfterTimestamp = Math.floor(Date.now() / 1000 - maxDelay);
  prune(newSignedData, maxIgnoreAfterTimestamp);

  const response: PostSignedDataResponseSchema = {
    count: newSignedData.length,
    skipped: batchSignedData.length - newSignedData.length,
  };

  return {
    statusCode: 201,
    headers: createResponseHeaders(), // Inserting data is done through POST request, so we do not cache it.
    body: JSON.stringify(response),
  };
};

// Returns the most fresh signed data for each templateId for the given airnode address. The API can be delayed, which
// filter out all signed data that happend in the specified "delaySeconds" parameter (essentially, such signed data is
// treated as non-existant).
export const getData = (
  endpoint: Endpoint,
  authorizationHeader: string | undefined,
  rawAirnodeAddress: string
): ApiResponse => {
  // Make sure the Airnode address is valid.
  const goAirnodeAddresses = goSync(() => evmAddressSchema.parse(rawAirnodeAddress));
  if (!goAirnodeAddresses.success) {
    return generateErrorResponse(400, 'Invalid request, airnode address must be an EVM address');
  }
  const airnodeAddress = goAirnodeAddresses.data;

  const { delaySeconds, authTokens, hideSignatures, isOev } = endpoint;
  const authToken = extractBearerToken(authorizationHeader);
  if (authTokens !== null && !authTokens.includes(authToken!)) {
    return generateErrorResponse(403, 'Invalid auth token', { authToken });
  }

  const { allowedAirnodes } = getConfig();
  if (allowedAirnodes !== '*' && !allowedAirnodes.some((allowedAirnode) => allowedAirnode.address === airnodeAddress)) {
    return generateErrorResponse(403, 'Unauthorized Airnode address', { airnodeAddress });
  }

  const ignoreAfterTimestamp = Math.floor(Date.now() / 1000 - delaySeconds);
  const cachedValues = getAll(airnodeAddress, ignoreAfterTimestamp, isOev);
  const data = cachedValues.reduce(
    (acc, signedData) => {
      const data = hideSignatures
        ? omit(signedData, 'beaconId', 'signature', 'isOevBeacon')
        : omit(signedData, 'beaconId', 'isOevBeacon');
      return { ...acc, [signedData.beaconId]: data };
    },
    {} as GetSignedDataResponseSchema['data'] | GetUnsignedDataResponseSchema['data']
  );
  const response: GetSignedDataResponseSchema | GetUnsignedDataResponseSchema = { count: cachedValues.length, data };

  return {
    statusCode: 200,
    headers: createResponseHeaders(getConfig().cache),
    body: JSON.stringify(response),
  };
};

// Returns all airnode addresses for which there is data. Note, that the delayed endpoint may not be allowed to show it.
// We do not return the allowed Airnode addresses in the configuration, because the value can be set to "*" and we
// would have to scan the database anyway.
export const listAirnodeAddresses = async (): Promise<ApiResponse> => {
  const goAirnodeAddresses = await go(getAllAirnodeAddresses);
  if (!goAirnodeAddresses.success) {
    return generateErrorResponse(500, 'Unable to scan database', { detail: goAirnodeAddresses.error.message });
  }
  const airnodeAddresses = goAirnodeAddresses.data;

  const response: GetAirnodesResponseSchema = {
    count: airnodeAddresses.length,
    data: airnodeAddresses,
  };

  return {
    statusCode: 200,
    headers: createResponseHeaders(getConfig().cache),
    body: JSON.stringify(response),
  };
};

export const getStatus = (): ApiResponse => {
  const config = getConfig();
  const configHash = createSha256Hash(serializePlainObject(config));
  const currentTimestamp = Math.floor(Date.now() / 1000).toString();

  // Get certified airnode addresses from config
  const certifiedAirnodes =
    config.allowedAirnodes === '*'
      ? []
      : config.allowedAirnodes.filter((airnode) => airnode.isCertified).map((airnode) => airnode.address);

  const response: GetStatusResponseSchema = {
    stage: config.stage,
    version: config.version,
    currentTimestamp,
    deploymentTimestamp: DEPLOYMENT_TIMESTAMP,
    configHash,
    certifiedAirnodes,
  };

  return {
    statusCode: 200,
    headers: createResponseHeaders(config.cache),
    body: JSON.stringify(response),
  };
};
