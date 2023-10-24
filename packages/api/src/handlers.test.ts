import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { omit } from 'lodash';

import { createSignedData, generateRandomWallet } from '../test/utils';

import * as cacheModule from './cache';
import * as configModule from './config';
import { batchInsertData, getData, listAirnodeAddresses } from './handlers';
import { logger } from './logger';

// eslint-disable-next-line jest/no-hooks
beforeEach(() => {
  jest
    .spyOn(configModule, 'getConfig')
    .mockImplementation(() => JSON.parse(readFileSync(join(__dirname, '../config/signed-api.example.json'), 'utf8')));
});

afterEach(() => {
  cacheModule.setCache({});
});

describe(batchInsertData.name, () => {
  it('drops the batch if it is invalid', async () => {
    const invalidData = await createSignedData({ signature: '0xInvalid' });
    const batchData = [await createSignedData(), invalidData];

    const result = await batchInsertData(batchData);

    expect(result).toStrictEqual({
      body: JSON.stringify({
        message: 'Unable to recover signer address',
        detail:
          'signature missing v and recoveryParam (argument="signature", value="0xInvalid", code=INVALID_ARGUMENT, version=bytes/5.7.0)',
        extra: invalidData,
      }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 400,
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
      await createSignedData(),
    ];
    jest.spyOn(logger, 'debug');

    const result = await batchInsertData(batchData);

    expect(result).toStrictEqual({
      body: JSON.stringify({ count: 1, skipped: 1 }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 201,
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'Skipping signed data because signed data with the same timestamp already exists',
      expect.any(Object)
    );
    expect(cacheModule.getCache()[storedSignedData.airnode]![storedSignedData.templateId]!).toHaveLength(1);
  });

  it('rejects a batch if there is a beacon with timestamp too far in the future', async () => {
    const batchData = [await createSignedData({ timestamp: (Math.floor(Date.now() / 1000) + 60 * 60 * 2).toString() })];

    const result = await batchInsertData(batchData);

    expect(result).toStrictEqual({
      body: JSON.stringify({ message: 'Request timestamp is too far in the future', extra: batchData[0] }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      statusCode: 400,
    });
  });

  it('inserts the batch if data is valid', async () => {
    const batchData = [await createSignedData(), await createSignedData()];

    const result = await batchInsertData(batchData);

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
      },
      [batchData[1]!.airnode]: {
        [batchData[1]!.templateId]: [batchData[1]],
      },
    });
  });
});

describe(getData.name, () => {
  it('drops the request if the airnode address is invalid', async () => {
    const batchData = [await createSignedData(), await createSignedData()];
    await batchInsertData(batchData);

    const result = await getData('0xInvalid', 0);

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
    await batchInsertData(batchData);

    const result = await getData(airnodeWallet.address, 0);

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
        'cache-control': 'no-store',
        'cdn-cache-control': 'max-age=10',
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
    await batchInsertData(batchData);

    const result = await getData(airnodeWallet.address, 30);

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
        'cache-control': 'no-store',
        'cdn-cache-control': 'max-age=10',
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
    await batchInsertData(batchData);

    const result = await listAirnodeAddresses();

    expect(result).toStrictEqual({
      body: JSON.stringify({
        count: 1,
        'available-airnodes': [airnodeWallet.address],
      }),
      headers: {
        'access-control-allow-methods': '*',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
        'cdn-cache-control': 'max-age=300',
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
  });
});
