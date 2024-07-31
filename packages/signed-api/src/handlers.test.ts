import { ethers } from 'ethers';
import { omit } from 'lodash';
import type Pool from 'workerpool/types/Pool';

import { getMockedConfig } from '../test/fixtures';
import { createInternalSignedData, createSignedData, generateRandomBytes, generateRandomWallet } from '../test/utils';

import * as configModule from './config/config';
import { batchInsertData, getData, listAirnodeAddresses } from './handlers';
import * as inMemoryCacheModule from './in-memory-cache';
import { logger } from './logger';
import { initializeVerifierPool } from './signed-data-verifier-pool';
import { type ApiResponse } from './types';
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
    const invalidData = await createSignedData({ signature: '0xInvalid' });

    const result = await batchInsertData(undefined, [invalidData], invalidData.airnode);
    const { body, statusCode } = parseResponse(result);
    [];
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
    const invalidData = await createSignedData({
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
    const data = await createSignedData();
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
    const batchData = [await createSignedData({ airnodeWallet })];

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
      await createSignedData({
        airnodeWallet,
        templateId: storedSignedData.templateId,
        timestamp: storedSignedData.timestamp,
      }),
      await createSignedData({ airnodeWallet }),
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
    const invalidData = await createSignedData({ timestamp: (Math.floor(Date.now() / 1000) + 60 * 60 * 2).toString() });

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
      await createSignedData({ airnodeWallet: airnodeWallet1 }),
      await createSignedData({ airnodeWallet: airnodeWallet2 }),
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
      await createSignedData({ airnodeWallet: airnodeWallet2 }),
      await createSignedData({ airnodeWallet: airnodeWallet2 }),
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
    const batchData = [await createSignedData({ airnodeWallet }), await createSignedData({ airnodeWallet })];

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
});

describe(getData.name, () => {
  it('drops the request if the airnode address is invalid', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedData({ airnodeWallet }), await createSignedData({ airnodeWallet })];
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
    const batchData = [await createSignedData({ airnodeWallet }), await createSignedData({ airnodeWallet })];
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
      await createSignedData({ airnodeWallet, timestamp: delayTimestamp }),
      await createSignedData({ airnodeWallet }),
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
    const batchData = [await createSignedData({ airnodeWallet }), await createSignedData({ airnodeWallet })];
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
});

describe(listAirnodeAddresses.name, () => {
  it('returns the list of airnode addresses', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedData({ airnodeWallet }), await createSignedData({ airnodeWallet })];
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
