import { ethers } from 'ethers';
import { omit } from 'lodash';

import { getMockedConfig } from '../test/fixtures';
import { createSignedData, deriveBeaconId, generateRandomBytes, generateRandomWallet } from '../test/utils';

import * as cacheModule from './cache';
import * as configModule from './config';
import { batchInsertData, getData, listAirnodeAddresses } from './handlers';
import { logger } from './logger';

// eslint-disable-next-line jest/no-hooks
beforeEach(() => {
  jest.spyOn(configModule, 'getConfig').mockImplementation(getMockedConfig);
});

afterEach(() => {
  cacheModule.setCache({});
});

describe(batchInsertData.name, () => {
  it('does not validate signature (for performance reasons)', async () => {
    const airnodeWallet = generateRandomWallet();
    const invalidData = await createSignedData({ airnodeWallet, signature: '0xInvalid' });
    const batchData = [await createSignedData({ airnodeWallet }), invalidData];

    const result = await batchInsertData(undefined, batchData);

    expect(result).toStrictEqual({
      body: JSON.stringify({ count: 2, skipped: 0 }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 201,
    });
  });

  it('does not validate beacon ID (for performance reasons)', async () => {
    const data = await createSignedData();
    const invalidData = { ...data, beaconId: deriveBeaconId(data.airnode, generateRandomBytes(32)) };

    const result = await batchInsertData(undefined, [invalidData]);

    expect(result).toStrictEqual({
      body: JSON.stringify({ count: 1, skipped: 0 }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 201,
    });
  });

  it('drops the batch if the airnode address is not allowed', async () => {
    const config = getMockedConfig();
    config.allowedAirnodes = [];
    jest.spyOn(configModule, 'getConfig').mockReturnValue(config);
    const airnodeWallet = ethers.Wallet.fromMnemonic(
      'wear lawsuit design cry express certain knock shrug credit wealth update walk'
    );
    const batchData = [await createSignedData({ airnodeWallet })];

    const result = await batchInsertData(undefined, batchData);

    expect(result).toStrictEqual({
      body: JSON.stringify({
        message: 'Unauthorized Airnode address',
        context: { airnodeAddress: '0x05E4B3cb2A6875bdD4CCb867B6aA833934EDDCBf' },
      }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 403,
    });
    expect(cacheModule.getCache()).toStrictEqual({});
  });

  it('skips signed data if there exists one with the same timestamp', async () => {
    const airnodeWallet = generateRandomWallet();
    const storedSignedData = await createSignedData({ airnodeWallet });
    cacheModule.setCache({
      [storedSignedData.airnode]: {
        [storedSignedData.templateId]: [storedSignedData],
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

    const result = await batchInsertData(undefined, batchData);

    expect(result).toStrictEqual({
      body: JSON.stringify({ count: 1, skipped: 1 }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 201,
    });
    expect(cacheModule.getCache()[storedSignedData.airnode]![storedSignedData.templateId]!).toHaveLength(1);
  });

  it('rejects a batch if there is a beacon with timestamp too far in the future', async () => {
    const batchData = [await createSignedData({ timestamp: (Math.floor(Date.now() / 1000) + 60 * 60 * 2).toString() })];

    const result = await batchInsertData(undefined, batchData);

    expect(result).toStrictEqual({
      body: JSON.stringify({
        message: 'Request timestamp is too far in the future',
        context: { signedData: batchData[0] },
      }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 400,
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

    const result = await batchInsertData(undefined, batchData);

    expect(result).toStrictEqual({
      body: JSON.stringify({
        message: 'All signed data must be from the same Airnode address',
        context: {
          airnodeAddresses: [
            '0x27f093777962Bb743E6cAC44cd724B84B725408a',
            '0xA0342Ba0319c0bCd66E770d74489aA2997a54bFb',
          ],
        },
      }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 400,
    });
  });

  it('inserts the batch if data is valid', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedData({ airnodeWallet }), await createSignedData({ airnodeWallet })];

    const result = await batchInsertData(undefined, batchData);

    expect(result).toStrictEqual({
      body: JSON.stringify({ count: 2, skipped: 0 }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 201,
    });
    expect(cacheModule.getCache()).toStrictEqual({
      [batchData[0]!.airnode]: {
        [batchData[0]!.templateId]: [batchData[0]],
        [batchData[1]!.templateId]: [batchData[1]],
      },
    });
  });
});

describe(getData.name, () => {
  it('drops the request if the airnode address is invalid', async () => {
    const batchData = [await createSignedData(), await createSignedData()];
    await batchInsertData(undefined, batchData);

    const result = await getData({ authTokens: null, delaySeconds: 0, urlPath: 'path' }, undefined, '0xInvalid');

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
    await batchInsertData(undefined, batchData);

    const result = await getData(
      { authTokens: null, delaySeconds: 0, urlPath: 'path' },
      undefined,
      airnodeWallet.address
    );

    expect(result).toStrictEqual({
      body: JSON.stringify({
        count: 2,
        data: {
          [batchData[0]!.beaconId]: omit(batchData[0], 'beaconId'),
          [batchData[1]!.beaconId]: omit(batchData[1], 'beaconId'),
        },
      }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
  });

  it('returns the delayed data', async () => {
    const airnodeWallet = generateRandomWallet();
    const delayTimestamp = (Math.floor(Date.now() / 1000) - 60).toString(); // Delayed by 60 seconds
    const batchData = [
      await createSignedData({ airnodeWallet, timestamp: delayTimestamp }),
      await createSignedData({ airnodeWallet }),
    ];
    await batchInsertData(undefined, batchData);

    const result = await getData(
      { authTokens: null, delaySeconds: 30, urlPath: 'path' },
      undefined,
      airnodeWallet.address
    );

    expect(result).toStrictEqual({
      body: JSON.stringify({
        count: 1,
        data: {
          [batchData[0]!.beaconId]: omit(batchData[0], 'beaconId'),
        },
      }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
  });
});

describe(listAirnodeAddresses.name, () => {
  it('returns the list of airnode addresses', async () => {
    const airnodeWallet = generateRandomWallet();
    const batchData = [await createSignedData({ airnodeWallet }), await createSignedData({ airnodeWallet })];
    await batchInsertData(undefined, batchData);

    const result = await listAirnodeAddresses();

    expect(result).toStrictEqual({
      body: JSON.stringify({
        count: 1,
        'available-airnodes': [airnodeWallet.address],
      }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
  });
});
