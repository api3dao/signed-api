import { type SignedApiBatchPayloadV2, type SignedApiBatchPayloadV1, deriveOevTemplateId } from '@api3/airnode-feed';
import { ethers } from 'ethers';
import { omit } from 'lodash';
import type Pool from 'workerpool/types/Pool';

import { getMockedConfig } from '../test/fixtures';
import {
  createInternalSignedData,
  createSignedDataV1,
  createSignedDataV2,
  generateRandomBytes,
  generateRandomWallet,
} from '../test/utils';

import * as configModule from './config/config';
import * as envModule from './env';
import { batchInsertData, getData, getStatus, listAirnodeAddresses } from './handlers';
import * as inMemoryCacheModule from './in-memory-cache';
import { logger } from './logger';
import { type EnvConfig } from './schema';
import { initializeVerifierPool } from './signed-data-verifier-pool';
import type { ApiResponse, GetStatusResponseSchema } from './types';
import { deriveBeaconId } from './utils';

let workerPool: Pool;

beforeAll(() => {
  // Done in beforeAll to avoid initializing the pool for each test for performance reasons.
  workerPool = initializeVerifierPool();
});

beforeEach(() => {
  jest.spyOn(configModule, 'getConfig').mockImplementation(getMockedConfig);
});

afterEach(() => {
  inMemoryCacheModule.setCache(inMemoryCacheModule.getInitialCache());
});

afterAll(async () => {
  await workerPool.terminate();
});

const parseResponse = <T = unknown>(response: ApiResponse) => {
  return { ...response, body: JSON.parse(response.body) } as {
    statusCode: number;
    headers: Record<string, string>;
    body: T;
  };
};

describe(batchInsertData.name, () => {
  it('verifies response shape', async () => {
    const invalidData = await createSignedDataV1({ signature: '0xInvalid' });

    const result = await batchInsertData(undefined, [invalidData], invalidData.airnode);
    const { body, statusCode } = parseResponse(result);
    expect(statusCode).toBe(400);
    expect(body).toStrictEqual({
      message: 'Invalid request, body must fit schema for batch of signed data',
      context: {
        v1ParsingIssues: [
          {
            validation: 'regex',
            code: 'invalid_string',
            message: 'Invalid',
            path: [0, 'signature'],
          },
        ],
        v2ParsingIssues: [
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'array',
            path: [],
            message: 'Expected object, received array',
          },
        ],
      },
    });
  }, 10_000);

  it('verifies signature', async () => {
    const invalidData = await createSignedDataV1({
      signature:
        '0xaa5f77b3141527b67903699c77f2fd66e1cdcdb71c7d586addc4e5f6b0a5ca25537495389753795b6c23240a45bb5a1295a9c2aa526385702c54863a0f94f45d1c',
    });

    const result = await batchInsertData(undefined, [invalidData], invalidData.airnode);
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(400);
    expect(body).toStrictEqual({
      message: 'Signature is invalid',
      context: {
        signedData: { ...invalidData, isOevBeacon: false },
      },
    });
  }, 10_000);

  it('validates beacon ID', async () => {
    const data = await createSignedDataV1();
    const invalidData = { ...data, beaconId: deriveBeaconId(data.airnode, generateRandomBytes(32)) };

    const result = await batchInsertData(undefined, [invalidData], invalidData.airnode);
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(400);
    expect(body).toStrictEqual({
      message: 'beaconId is invalid',
      context: {
        signedData: { ...invalidData, isOevBeacon: false },
      },
    });
  }, 10_000);

  it('drops the batch if the airnode address is not allowed', async () => {
    const config = getMockedConfig();
    config.allowedAirnodes = [];
    jest.spyOn(configModule, 'getConfig').mockReturnValue(config);
    const airnodeWallet = ethers.Wallet.fromMnemonic(
      'wear lawsuit design cry express certain knock shrug credit wealth update walk'
    );
    const batchData = [await createSignedDataV1({ airnodeWallet })];

    const result = await batchInsertData(undefined, batchData, airnodeWallet.address);
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(403);
    expect(body).toStrictEqual({
      message: 'Unauthorized Airnode address',
      context: { airnodeAddress: airnodeWallet.address },
    });
    expect(inMemoryCacheModule.getCache()).toStrictEqual(inMemoryCacheModule.getInitialCache());
  });

  it('skips signed data if there exists one with the same timestamp', async () => {
    const airnodeWallet = generateRandomWallet();
    const storedSignedData = await createInternalSignedData({ airnodeWallet });
    inMemoryCacheModule.setCache({
      ...inMemoryCacheModule.getCache(),
      signedDataCache: {
        [storedSignedData.airnode]: {
          [storedSignedData.templateId]: [storedSignedData],
        },
      },
    });
    const batchData = [
      await createSignedDataV1({
        airnodeWallet,
        templateId: storedSignedData.templateId,
        timestamp: storedSignedData.timestamp,
      }),
      await createSignedDataV1({ airnodeWallet }),
    ];
    jest.spyOn(logger, 'debug');

    const result = await batchInsertData(undefined, batchData, airnodeWallet.address);

    expect(result).toStrictEqual({
      body: JSON.stringify({ count: 1, skipped: 1 }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 201,
    });
    expect(
      inMemoryCacheModule.getCache().signedDataCache[storedSignedData.airnode]![storedSignedData.templateId]
    ).toHaveLength(1);
  });

  it('rejects a batch if there is a beacon with timestamp too far in the future', async () => {
    const invalidData = await createSignedDataV1({
      timestamp: (Math.floor(Date.now() / 1000) + 60 * 60 * 2).toString(),
    });

    const result = await batchInsertData(undefined, [invalidData], invalidData.airnode);
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(400);
    expect(body).toStrictEqual({
      message: 'Request timestamp is too far in the future',
      context: { signedData: { ...invalidData, isOevBeacon: false } },
    });
  });

  it('rejects a batch if there it contains data for multiple Airnode addresses', async () => {
    const airnodeWallet1 = ethers.Wallet.fromMnemonic(
      'echo dose empower ensure purchase enjoy once hotel slender loop repair desk'
    );
    const airnodeWallet2 = ethers.Wallet.fromMnemonic(
      'clay drift protect wise love frost tourist eyebrow glide cost comfort punch'
    );
    const batchData = [
      await createSignedDataV1({ airnodeWallet: airnodeWallet1 }),
      await createSignedDataV1({ airnodeWallet: airnodeWallet2 }),
    ];

    const result = await batchInsertData(undefined, batchData, airnodeWallet1.address);
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(400);
    expect(body).toStrictEqual({
      message: 'All signed data must be from the same Airnode address',
      context: {
        airnodeAddresses: ['0x27f093777962Bb743E6cAC44cd724B84B725408a', '0xA0342Ba0319c0bCd66E770d74489aA2997a54bFb'],
      },
    });
  });

  it('rejects a batch when the path parameter conflicts with the Airnode address populated in the signed data', async () => {
    const airnodeWallet1 = ethers.Wallet.fromMnemonic(
      'echo dose empower ensure purchase enjoy once hotel slender loop repair desk'
    );
    const airnodeWallet2 = ethers.Wallet.fromMnemonic(
      'clay drift protect wise love frost tourist eyebrow glide cost comfort punch'
    );
    const batchData = [
      await createSignedDataV1({ airnodeWallet: airnodeWallet2 }),
      await createSignedDataV1({ airnodeWallet: airnodeWallet2 }),
    ];

    const result = await batchInsertData(undefined, batchData, airnodeWallet1.address);
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(400);
    expect(body).toStrictEqual({
      message: 'Airnode address in the path parameter does not match one in the signed data',
      context: {
        airnodeAddress: airnodeWallet1.address,
        signedData: { ...batchData[0], isOevBeacon: false },
      },
    });
  });

  it('inserts the batch if data is valid', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedDataV1({ airnodeWallet }), await createSignedDataV1({ airnodeWallet })];

    const result = await batchInsertData(undefined, batchData, airnodeWallet.address);
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(201);
    expect(body).toStrictEqual({
      count: 2,
      skipped: 0,
    });
    expect(inMemoryCacheModule.getCache()).toStrictEqual({
      ...inMemoryCacheModule.getInitialCache(),
      signedDataCache: {
        [batchData[0]!.airnode]: {
          [batchData[0]!.templateId]: [{ ...batchData[0], isOevBeacon: false }],
          [batchData[1]!.templateId]: [{ ...batchData[1], isOevBeacon: false }],
        },
      },
    });
  });

  it('logs the data with delay if LOG_API_DATA is enabled', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedDataV1({ airnodeWallet }), await createSignedDataV1({ airnodeWallet })];
    jest.spyOn(envModule, 'loadEnv').mockReturnValue({ LOG_API_DATA: true } as EnvConfig);
    jest.spyOn(logger, 'info');
    jest.useFakeTimers();

    const result = await batchInsertData(undefined, batchData, airnodeWallet.address);
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(201);
    expect(body).toStrictEqual({
      count: 2,
      skipped: 0,
    });
    expect(inMemoryCacheModule.getCache()).toStrictEqual({
      ...inMemoryCacheModule.getInitialCache(),
      signedDataCache: {
        [batchData[0]!.airnode]: {
          [batchData[0]!.templateId]: [{ ...batchData[0], isOevBeacon: false }],
          [batchData[1]!.templateId]: [{ ...batchData[1], isOevBeacon: false }],
        },
      },
    });

    // Advance time just before 5 minutes and verify that the logger was not called.
    jest.advanceTimersByTime(5 * 60 * 1000 - 1);
    expect(logger.info).not.toHaveBeenCalled();

    // Advance time pass the delay period and verify that the data was called.
    jest.advanceTimersByTime(1);
    expect(logger.info).toHaveBeenCalledWith('Received valid signed data.', {
      data: batchData.map((d) => omit(d, ['beaconId'])),
    });
  });
});

describe(getData.name, () => {
  it('drops the request if the airnode address is invalid', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedDataV1({ airnodeWallet }), await createSignedDataV1({ airnodeWallet })];
    await batchInsertData(undefined, batchData, airnodeWallet.address);

    const result = getData(
      { authTokens: null, delaySeconds: 0, urlPath: 'path', hideSignatures: false, isOev: false },
      undefined,
      '0xInvalid'
    );

    expect(result).toStrictEqual({
      body: JSON.stringify({ message: 'Invalid request, airnode address must be an EVM address' }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 400,
    });
  });

  it('returns the live data', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedDataV1({ airnodeWallet }), await createSignedDataV1({ airnodeWallet })];
    await batchInsertData(undefined, batchData, airnodeWallet.address);

    const result = getData(
      { authTokens: null, delaySeconds: 0, urlPath: 'path', hideSignatures: false, isOev: false },
      undefined,
      airnodeWallet.address
    );
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      count: 2,
      data: {
        [batchData[0]!.beaconId]: omit(batchData[0], 'beaconId', 'isOevBeacon'),
        [batchData[1]!.beaconId]: omit(batchData[1], 'beaconId', 'isOevBeacon'),
      },
    });
  });

  it('returns the delayed data', async () => {
    const airnodeWallet = generateRandomWallet();
    const delayTimestamp = (Math.floor(Date.now() / 1000) - 60).toString(); // Delayed by 60 seconds
    const batchData = [
      await createSignedDataV1({ airnodeWallet, timestamp: delayTimestamp }),
      await createSignedDataV1({ airnodeWallet }),
    ];
    await batchInsertData(undefined, batchData, airnodeWallet.address);

    const result = getData(
      { authTokens: null, delaySeconds: 30, urlPath: 'path', hideSignatures: false, isOev: false },
      undefined,
      airnodeWallet.address
    );
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      count: 1,
      data: {
        [batchData[0]!.beaconId]: omit(batchData[0], 'beaconId', 'isOevBeacon'),
      },
    });
  });

  it('returns the data without signatures when hideSignatures flag is enabled', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedDataV1({ airnodeWallet }), await createSignedDataV1({ airnodeWallet })];
    await batchInsertData(undefined, batchData, airnodeWallet.address);

    const result = getData(
      { authTokens: null, delaySeconds: 0, urlPath: 'path', hideSignatures: true, isOev: false },
      undefined,
      airnodeWallet.address
    );
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      count: 2,
      data: {
        [batchData[0]!.beaconId]: omit(batchData[0], 'beaconId', 'signature', 'isOevBeacon'),
        [batchData[1]!.beaconId]: omit(batchData[1], 'beaconId', 'signature', 'isOevBeacon'),
      },
    });
  });

  it('accepts the v1 data format', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData: SignedApiBatchPayloadV1 = [
      await createSignedDataV1({ airnodeWallet }),
      await createSignedDataV1({ airnodeWallet }),
    ];

    await batchInsertData(undefined, batchData, airnodeWallet.address);

    const result = getData(
      { authTokens: null, delaySeconds: 0, urlPath: 'path', hideSignatures: false, isOev: false },
      undefined,
      airnodeWallet.address
    );
    const { body, statusCode } = parseResponse(result);
    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      count: 2,
      data: {
        [batchData[0]!.beaconId]: omit(batchData[0], 'beaconId', 'isOevBeacon'),
        [batchData[1]!.beaconId]: omit(batchData[1], 'beaconId', 'isOevBeacon'),
      },
    });
  });

  it('accepts the v2 data format', async () => {
    const airnodeWallet = generateRandomWallet();
    const airnode = airnodeWallet.address;
    const batchData: SignedApiBatchPayloadV2 = {
      airnode,
      signedData: [await createSignedDataV2({ airnodeWallet }), await createSignedDataV2({ airnodeWallet })],
    };
    const beaconId1 = deriveBeaconId(airnodeWallet.address, batchData.signedData[0]!.templateId);
    const beaconId2 = deriveBeaconId(airnodeWallet.address, batchData.signedData[1]!.templateId);

    await batchInsertData(undefined, batchData, airnodeWallet.address);

    const result = getData(
      { authTokens: null, delaySeconds: 0, urlPath: 'path', hideSignatures: false, isOev: false },
      undefined,
      airnodeWallet.address
    );
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      count: 2,
      data: {
        [beaconId1]: { ...omit(batchData.signedData[0], 'beaconId', 'isOevBeacon', 'oevSignature'), airnode },
        [beaconId2]: { ...omit(batchData.signedData[1], 'beaconId', 'isOevBeacon', 'oevSignature'), airnode },
      },
    });
  });

  it('returns only OEV beacons for OEV endpoint', async () => {
    const airnodeWallet = generateRandomWallet();
    const airnode = airnodeWallet.address;
    const batchData: SignedApiBatchPayloadV2 = {
      airnode,
      signedData: [await createSignedDataV2({ airnodeWallet }), await createSignedDataV2({ airnodeWallet })],
    };
    const oevTemplateId1 = deriveOevTemplateId(batchData.signedData[0]!.templateId);
    const oevTemplateId2 = deriveOevTemplateId(batchData.signedData[1]!.templateId);
    const beaconId1 = deriveBeaconId(airnodeWallet.address, oevTemplateId1);
    const beaconId2 = deriveBeaconId(airnodeWallet.address, oevTemplateId2);

    await batchInsertData(undefined, batchData, airnodeWallet.address);

    const result = getData(
      { authTokens: null, delaySeconds: 0, urlPath: 'path', hideSignatures: false, isOev: true },
      undefined,
      airnodeWallet.address
    );
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      count: 2,
      data: {
        [beaconId1]: {
          ...omit(batchData.signedData[0], 'beaconId', 'isOevBeacon', 'oevSignature'),
          airnode,
          templateId: oevTemplateId1,
          signature: batchData.signedData[0]!.oevSignature,
        },
        [beaconId2]: {
          ...omit(batchData.signedData[1], 'beaconId', 'isOevBeacon', 'oevSignature'),
          airnode,
          templateId: oevTemplateId2,
          signature: batchData.signedData[1]!.oevSignature,
        },
      },
    });
  });

  it('returns no OEV beacons for OEV endpoint when airnode-feed is v1', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData: SignedApiBatchPayloadV1 = [
      await createSignedDataV1({ airnodeWallet }),
      await createSignedDataV1({ airnodeWallet }),
    ];

    await batchInsertData(undefined, batchData, airnodeWallet.address);

    const result = getData(
      { authTokens: null, delaySeconds: 0, urlPath: 'path', hideSignatures: false, isOev: true },
      undefined,
      airnodeWallet.address
    );
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      count: 0,
      data: {},
    });
  });

  it('fails to insert invalid OEV data', async () => {
    const airnodeWallet = generateRandomWallet();
    // The signature is a random string of the correct length, mocking some Airnode feed issue.
    const invalidData = await createSignedDataV2({
      airnodeWallet,
      oevSignature:
        '0x585736a2ecc01d462dc84d88fbe8fa4687428eb9cce8c1f3f305e77747bbf3d30e9c79703af9d232ac1cafd72a6b7c5327abb21055c5c98a4832d1eaf96f53ed1b',
    });
    const insertPayload: SignedApiBatchPayloadV2 = {
      airnode: airnodeWallet.address,
      signedData: [invalidData],
    };
    const oevTemplateId = deriveOevTemplateId(invalidData.templateId);
    const beaconId = deriveBeaconId(airnodeWallet.address, oevTemplateId);

    const result = await batchInsertData(undefined, insertPayload, airnodeWallet.address);
    const { body, statusCode } = parseResponse(result);
    expect(statusCode).toBe(400);
    expect(body).toStrictEqual({
      message: 'Signature is invalid',
      context: {
        signedData: {
          airnode: airnodeWallet.address,
          beaconId,
          encodedValue: invalidData.encodedValue,
          isOevBeacon: true,
          signature: invalidData.oevSignature,
          templateId: oevTemplateId,
          timestamp: invalidData.timestamp,
        },
      },
    });
  }, 10_000);
});

describe(listAirnodeAddresses.name, () => {
  it('returns the list of airnode addresses', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedDataV1({ airnodeWallet }), await createSignedDataV1({ airnodeWallet })];
    await batchInsertData(undefined, batchData, airnodeWallet.address);

    const result = await listAirnodeAddresses();
    const { body, statusCode } = parseResponse(result);

    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      count: 1,
      'available-airnodes': [airnodeWallet.address],
    });
  });
});

describe(getStatus.name, () => {
  const mockDate = new Date('2024-01-01T00:00:00Z');
  const mockTimestamp = Math.floor(mockDate.getTime() / 1000).toString();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty certified airnode addresses when config has "*"', () => {
    const config = getMockedConfig();
    config.allowedAirnodes = '*';
    jest.spyOn(configModule, 'getConfig').mockReturnValue(config);

    const result = getStatus();
    const { body, statusCode } = parseResponse<GetStatusResponseSchema>(result);

    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      certifiedAirnodes: [],
      stage: config.stage,
      version: config.version,
      currentTimestamp: mockTimestamp,
      deploymentTimestamp: expect.any(String),
      configHash: expect.any(String),
    });
  });

  it('returns certified airnode addresses when config has specific airnodes', () => {
    const config = getMockedConfig();
    config.allowedAirnodes = [
      { address: '0xA0342Ba0319c0bCd66E770d74489aA2997a54bFb', authTokens: ['token1'], isCertified: true },
      { address: '0x27f093777962Bb743E6cAC44cd724B84B725408a', authTokens: null, isCertified: false },
    ];
    jest.spyOn(configModule, 'getConfig').mockReturnValue(config);

    const result = getStatus();
    const { body, statusCode } = parseResponse<GetStatusResponseSchema>(result);

    expect(statusCode).toBe(200);
    expect(body).toStrictEqual({
      certifiedAirnodes: ['0xA0342Ba0319c0bCd66E770d74489aA2997a54bFb'],
      stage: config.stage,
      version: config.version,
      currentTimestamp: mockTimestamp,
      deploymentTimestamp: expect.any(String),
      configHash: expect.any(String),
    });
  });

  it('generates consistent configHash for same config', () => {
    const config = getMockedConfig();
    jest.spyOn(configModule, 'getConfig').mockReturnValue(config);

    const result1 = getStatus();
    const result2 = getStatus();

    const body1 = parseResponse<GetStatusResponseSchema>(result1).body;
    const body2 = parseResponse<GetStatusResponseSchema>(result2).body;

    expect(body1.configHash).toBe(body2.configHash);
  });

  it('generates different configHash for different configs', () => {
    const config1 = getMockedConfig();
    const config2 = { ...getMockedConfig(), stage: 'different-stage' };

    jest.spyOn(configModule, 'getConfig').mockReturnValueOnce(config1).mockReturnValueOnce(config2);

    const result1 = getStatus();
    const result2 = getStatus();

    const body1 = parseResponse<GetStatusResponseSchema>(result1).body;
    const body2 = parseResponse<GetStatusResponseSchema>(result2).body;

    expect(body1.configHash).not.toBe(body2.configHash);
  });

  it('maintains same deploymentTimestamp across multiple calls', () => {
    const config = getMockedConfig();
    jest.spyOn(configModule, 'getConfig').mockReturnValue(config);

    const result1 = getStatus();

    // Advance time by 1 hour
    jest.advanceTimersByTime(60 * 60 * 1000);

    const result2 = getStatus();

    const body1 = parseResponse<GetStatusResponseSchema>(result1).body;
    const body2 = parseResponse<GetStatusResponseSchema>(result2).body;

    expect(body1.deploymentTimestamp).toBe(body2.deploymentTimestamp);
    expect(body1.currentTimestamp).not.toBe(body2.currentTimestamp);
  });
});
