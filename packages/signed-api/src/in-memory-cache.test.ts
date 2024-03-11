import { groupBy } from 'lodash';

import { createSignedData, generateRandomWallet } from '../test/utils';

import * as cacheModule from './cache';
import { get, getAll, getAllAirnodeAddresses, ignoreTooFreshData, prune, put, putAll } from './in-memory-cache';

afterEach(() => {
  cacheModule.setCache({});
});

describe(ignoreTooFreshData.name, () => {
  const createData = async () => [
    await createSignedData({ timestamp: '100' }),
    await createSignedData({ timestamp: '199' }),
    await createSignedData({ timestamp: '200' }),
    await createSignedData({ timestamp: '201' }),
    await createSignedData({ timestamp: '300' }),
  ];

  it('ignores all values with higher timestamp', async () => {
    const data = await createData();

    const result = ignoreTooFreshData(data, 200);

    expect(result).toStrictEqual(data.slice(0, 3));
  });

  it('returns all data when compared with infinity', async () => {
    const data = await createData();

    const result = ignoreTooFreshData(data, Number.POSITIVE_INFINITY);

    expect(result).toStrictEqual(data);
  });
});

describe(get.name, () => {
  const mockCacheData = async () => {
    const airnodeWallet = generateRandomWallet();
    const data = await createSignedData({ airnodeWallet, timestamp: '100' });
    const allData = [
      data,
      await createSignedData({ airnodeWallet, templateId: data.templateId, timestamp: '101' }),
      await createSignedData({ airnodeWallet, templateId: data.templateId, timestamp: '103' }),
    ];
    jest.spyOn(cacheModule, 'getCache').mockReturnValueOnce({
      [data.airnode]: { [data.templateId]: allData },
    });

    return allData;
  };

  it('returns null if there is no data', () => {
    const result = get('non-existent-airnode', 'non-existent-template', 0);

    expect(result).toBeNull();
  });

  it('returns null if data is too fresh', async () => {
    const [data] = await mockCacheData();

    const result = get(data!.airnode, data!.templateId, 50);

    expect(result).toBeNull();
  });

  it('returns the freshest non-ignored data', async () => {
    const allData = await mockCacheData();
    const data = allData[0]!;

    const result = get(data.airnode, data.templateId, 101);

    expect(result).toStrictEqual(allData[1]);
    expect(allData[1]!.timestamp).toBe('101');
  });

  it('returns the freshest data available to be returned', async () => {
    const allData = await mockCacheData();
    const data = allData[0]!;

    const result = get(data.airnode, data.templateId, Number.POSITIVE_INFINITY);

    expect(result).toStrictEqual(allData[2]);
    expect(allData[2]!.timestamp).toBe('103');
  });
});

describe(getAll.name, () => {
  const mockCacheData = async () => {
    const airnodeWallet = generateRandomWallet();
    const data = await createSignedData({ airnodeWallet, timestamp: '100' });
    const allData = [
      data,
      await createSignedData({ airnodeWallet, templateId: data.templateId, timestamp: '105' }),
      await createSignedData({ airnodeWallet, timestamp: '300' }),
      await createSignedData({ airnodeWallet, timestamp: '400' }),
    ];

    // Ned to use mockReturnValue instead of mockReturnValueOnce because the getCache call is used multiple times
    // internally depending on the number of data inserted.
    jest.spyOn(cacheModule, 'getCache').mockReturnValue({
      [data.airnode]: groupBy(allData, 'templateId'),
    });

    return allData;
  };

  it('returns freshest data for the given airnode', async () => {
    const allData = await mockCacheData();

    const result = getAll(allData[0]!.airnode, Number.POSITIVE_INFINITY);

    // The first data is overridden by the fresher (second) data.
    expect(result).toStrictEqual([allData[1], allData[2], allData[3]]);
  });

  it('returns freshest data for the given airnode respecting delay', async () => {
    const allData = await mockCacheData();

    const result = getAll(allData[0]!.airnode, 100);

    expect(result).toStrictEqual([allData[0]]);
  });
});

describe(getAllAirnodeAddresses.name, () => {
  const mockCacheData = async () => {
    const airnodeWallet1 = generateRandomWallet();
    const airnodeWallet2 = generateRandomWallet();
    const data1 = await createSignedData({ airnodeWallet: airnodeWallet1, timestamp: '100' });
    const data2 = await createSignedData({ airnodeWallet: airnodeWallet2, timestamp: '200' });
    const allData1 = [
      data1,
      await createSignedData({ airnodeWallet: airnodeWallet1, templateId: data1.templateId, timestamp: '105' }),
    ];
    const allData2 = [
      data2,
      await createSignedData({ airnodeWallet: airnodeWallet2, templateId: data2.templateId, timestamp: '205' }),
    ];
    const cache = {
      [data1.airnode]: { [data1.templateId]: allData1 },
      [data2.airnode]: { [data2.templateId]: allData2 },
    };
    jest.spyOn(cacheModule, 'getCache').mockReturnValueOnce(cache);

    return cache;
  };

  it('returns all airnode addresses', async () => {
    const cache = await mockCacheData();

    const result = getAllAirnodeAddresses();

    expect(result).toStrictEqual(Object.keys(cache));
  });
});

describe(put.name, () => {
  it('inserts the data in the correct position', async () => {
    const airnodeWallet = generateRandomWallet();
    const data = await createSignedData({ airnodeWallet, timestamp: '100' });
    const allData = [
      data,
      await createSignedData({ airnodeWallet, templateId: data.templateId, timestamp: '105' }),
      await createSignedData({ airnodeWallet, templateId: data.templateId, timestamp: '110' }),
    ];
    // We can't mock because the implementation mutates the cache value directly.
    cacheModule.setCache({
      [data.airnode]: groupBy(allData, 'templateId'),
    });
    const newData = await createSignedData({
      airnodeWallet,
      templateId: data.templateId,
      timestamp: '103',
    });

    put(newData);

    const cache = cacheModule.getCache();
    expect(cache[data.airnode]![data.templateId]).toStrictEqual([allData[0], newData, allData[1], allData[2]]);
  });
});

describe(putAll.name, () => {
  it('inserts the data in the correct positions', async () => {
    const airnodeWallet = generateRandomWallet();
    const data = await createSignedData({ airnodeWallet, timestamp: '100' });
    const allData = [
      data,
      await createSignedData({ airnodeWallet, templateId: data.templateId, timestamp: '105' }),
      await createSignedData({ airnodeWallet, templateId: data.templateId, timestamp: '110' }),
    ];
    // We can't mock because the implementation mutates the cache value directly.
    cacheModule.setCache({
      [data.airnode]: groupBy(allData, 'templateId'),
    });
    const newDataBatch = [
      await createSignedData({
        airnodeWallet,
        templateId: data.templateId,
        timestamp: '103',
      }),
      await createSignedData(),
    ];

    putAll(newDataBatch);

    const cache = cacheModule.getCache();
    expect(cache[data.airnode]![data.templateId]).toStrictEqual([allData[0], newDataBatch[0], allData[1], allData[2]]);
    expect(cache[newDataBatch[1]!.airnode]![newDataBatch[1]!.templateId]).toStrictEqual([newDataBatch[1]]);
  });
});

describe(prune.name, () => {
  it('removes all data that is too old', async () => {
    const airnodeWallet = generateRandomWallet();
    const data = await createSignedData({ airnodeWallet, timestamp: '100' });
    const insertData = [
      data,
      await createSignedData({ airnodeWallet, templateId: data.templateId, timestamp: '105' }),
      await createSignedData({ airnodeWallet, templateId: data.templateId, timestamp: '110' }),
    ];
    const otherAirnodeWallet = generateRandomWallet();
    const otherAirnodeData = await createSignedData({ airnodeWallet: otherAirnodeWallet, timestamp: '80' });
    const otherAirnodeInsertData = [
      otherAirnodeData,
      await createSignedData({
        airnodeWallet: otherAirnodeWallet,
        templateId: otherAirnodeData.templateId,
        timestamp: '90',
      }),
    ];
    const batchInsertData = [...insertData, ...otherAirnodeInsertData];
    // We can't mock because the implementation mutates the cache value directly.
    cacheModule.setCache({
      [data.airnode]: groupBy(insertData, 'templateId'),
      [otherAirnodeData.airnode]: groupBy(otherAirnodeInsertData, 'templateId'),
    });

    prune(batchInsertData, 105);

    const cache = cacheModule.getCache();
    expect(cache[data.airnode]![data.templateId]).toStrictEqual([insertData[1], insertData[2]]);
    expect(cache[otherAirnodeData.airnode]![otherAirnodeData.templateId]).toStrictEqual([otherAirnodeInsertData[1]]);
  });
});
