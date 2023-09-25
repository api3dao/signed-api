import { groupBy } from 'lodash';
import { get, getAll, getAllAirnodeAddresses, ignoreTooFreshData, put, putAll } from './in-memory-cache';
import * as cacheModule from './cache';
import { createSignedData, generateRandomWallet } from '../test/utils';

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

    expect(result).toEqual(data.slice(0, 3));
  });

  it('returns all data when compared with infinity', async () => {
    const data = await createData();

    const result = ignoreTooFreshData(data, Infinity);

    expect(result).toEqual(data);
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

  it('returns null if there is no data', async () => {
    const result = await get('non-existent-airnode', 'non-existent-template', 0);

    expect(result).toEqual(null);
  });

  it('returns null if data is too fresh', async () => {
    const [data] = await mockCacheData();

    const result = await get(data!.airnode, data!.templateId, 50);

    expect(result).toEqual(null);
  });

  it('returns the freshest non-ignored data', async () => {
    const allData = await mockCacheData();
    const data = allData[0]!;

    const result = await get(data!.airnode, data!.templateId, 101);

    expect(result).toEqual(allData[1]);
    expect(allData[1]!.timestamp).toEqual('101');
  });

  it('returns the freshest data available to be returned', async () => {
    const allData = await mockCacheData();
    const data = allData[0]!;

    const result = await get(data.airnode, data.templateId, Infinity);

    expect(result).toEqual(allData[2]);
    expect(allData[2]!.timestamp).toEqual('103');
  });
});

describe(getAll.name, () => {
  const mockCacheData = async () => {
    const airnodeWallet = generateRandomWallet();
    const data = await createSignedData({ airnodeWallet: airnodeWallet, timestamp: '100' });
    const allData = [
      data,
      await createSignedData({ airnodeWallet: airnodeWallet, templateId: data.templateId, timestamp: '105' }),
      await createSignedData({ airnodeWallet: airnodeWallet, timestamp: '300' }),
      await createSignedData({ airnodeWallet: airnodeWallet, timestamp: '400' }),
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

    const result = await getAll(allData[0]!.airnode, Infinity);

    // The first data is overridden by the fresher (second) data.
    expect(result).toEqual([allData[1], allData[2], allData[3]]);
  });

  it('returns freshest data for the given airnode respecting delay', async () => {
    const allData = await mockCacheData();

    const result = await getAll(allData[0]!.airnode, 100);

    expect(result).toEqual([allData[0]]);
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

    const result = await getAllAirnodeAddresses();

    expect(result).toEqual(Object.keys(cache));
  });
});

describe(put.name, () => {
  afterEach(() => {
    cacheModule.setCache({});
  });

  it('inserts the data in the correct position', async () => {
    const airnodeWallet = generateRandomWallet();
    const data = await createSignedData({ airnodeWallet: airnodeWallet, timestamp: '100' });
    const allData = [
      data,
      await createSignedData({ airnodeWallet: airnodeWallet, templateId: data.templateId, timestamp: '105' }),
      await createSignedData({ airnodeWallet: airnodeWallet, templateId: data.templateId, timestamp: '110' }),
    ];
    // We can't mock because the implementation mutates the cache value directly.
    cacheModule.setCache({
      [data.airnode]: groupBy(allData, 'templateId'),
    });
    const newData = await createSignedData({
      airnodeWallet,
      templateId: data!.templateId,
      timestamp: '103',
    });

    await put(newData);

    const cache = cacheModule.getCache();
    expect(cache[data!.airnode]![data!.templateId]).toEqual([allData[0], newData, allData[1], allData[2]]);
  });
});

describe(putAll.name, () => {
  it('inserts the data in the correct positions', async () => {
    const airnodeWallet = generateRandomWallet();
    const data = await createSignedData({ airnodeWallet: airnodeWallet, timestamp: '100' });
    const allData = [
      data,
      await createSignedData({ airnodeWallet: airnodeWallet, templateId: data.templateId, timestamp: '105' }),
      await createSignedData({ airnodeWallet: airnodeWallet, templateId: data.templateId, timestamp: '110' }),
    ];
    // We can't mock because the implementation mutates the cache value directly.
    cacheModule.setCache({
      [data.airnode]: groupBy(allData, 'templateId'),
    });
    const newDataBatch = [
      await createSignedData({
        airnodeWallet,
        templateId: data!.templateId,
        timestamp: '103',
      }),
      await createSignedData(),
    ];

    await putAll(newDataBatch);

    const cache = cacheModule.getCache();
    expect(cache[data!.airnode]![data!.templateId]).toEqual([allData[0], newDataBatch[0], allData[1], allData[2]]);
    expect(cache[newDataBatch[1]!.airnode]![newDataBatch[1]!.templateId]).toEqual([newDataBatch[1]]);
  });
});
