import { last, uniqBy } from 'lodash';
import { isIgnored } from './utils';
import { SignedData } from './schema';
import { getCache } from './cache';
import { logger } from './logger';

export const ignoreTooFreshData = (signedDatas: SignedData[], ignoreAfterTimestamp: number) =>
  signedDatas.filter((data) => !isIgnored(data, ignoreAfterTimestamp));

// The API is deliberately asynchronous to mimic a database call.
export const get = async (airnodeId: string, templateId: string, ignoreAfterTimestamp: number) => {
  logger.debug('Getting signed data', { airnodeId, templateId, ignoreAfterTimestamp });

  const signedDataCache = getCache();
  if (!signedDataCache[airnodeId]) return null;
  const signedDatas = signedDataCache[airnodeId]![templateId];
  if (!signedDatas) return null;

  return last(ignoreTooFreshData(signedDatas, ignoreAfterTimestamp)) ?? null;
};

// The API is deliberately asynchronous to mimic a database call.
export const getAll = async (airnodeId: string, ignoreAfterTimestamp: number) => {
  logger.debug('Getting all signed data', { airnodeId, ignoreAfterTimestamp });

  const signedDataCache = getCache();
  const signedDataByTemplateId = signedDataCache[airnodeId] ?? {};
  const freshestSignedData: SignedData[] = [];
  for (const templateId of Object.keys(signedDataByTemplateId)) {
    const freshest = await get(airnodeId, templateId, ignoreAfterTimestamp);
    if (freshest) freshestSignedData.push(freshest);
  }

  return freshestSignedData;
};

// The API is deliberately asynchronous to mimic a database call.
//
// The Airnode addresses are returned independently of how old the data is. This means that an API can get all Airnode
// addresses and then use a delayed endpoint to get data from each, but fail to get data from some of them.
export const getAllAirnodeAddresses = async () => {
  logger.debug('Getting all Airnode addresses');

  return Object.keys(getCache());
};

// The API is deliberately asynchronous to mimic a database call.
export const put = async (signedData: SignedData) => {
  logger.debug('Putting signed data', { signedData });

  const signedDataCache = getCache();
  const { airnode, templateId } = signedData;
  signedDataCache[airnode] ??= {};
  signedDataCache[airnode]![templateId] ??= [];

  // We need to insert the signed data in the correct position in the array based on the timestamp. It would be more
  // efficient to use a priority queue, but the proper solution is not to store the data in memory.
  const signedDatas = signedDataCache[airnode]![templateId]!;
  const index = signedDatas.findIndex((data) => parseInt(data.timestamp) > parseInt(signedData.timestamp));
  if (index < 0) signedDatas.push(signedData);
  else signedDatas.splice(index, 0, signedData);
};

// The API is deliberately asynchronous to mimic a database call.
export const putAll = async (signedDataArray: SignedData[]) => {
  logger.debug('Putting all signed data', { signedDataArray });

  for (const signedData of signedDataArray) await put(signedData);
};

// The API is deliberately asynchronous to mimic a database call.
//
// Removes all signed data that is no longer needed to be kept in memory (because it is too old and there exist a newer
// signed data for each endpoint). The function is intended to be called after each insertion of new signed data for
// performance reasons, because it only looks to prune the data that for beacons that have been just inserted.
export const prune = async (signedDataArray: SignedData[], maxIgnoreAfterTimestamp: number) => {
  const beaconsToPrune = uniqBy(signedDataArray, 'beaconId');
  logger.debug('Pruning signed data', { maxIgnoreAfterTimestamp });
  const signedDataCache = getCache();

  for (const beacon of beaconsToPrune) {
    const { airnode, templateId } = beacon;
    const allSignedDatas = signedDataCache[airnode]![templateId]!; // Assume the data is inserted the cache.
    const signedDatas = ignoreTooFreshData(allSignedDatas, maxIgnoreAfterTimestamp);

    // It is enough to keep only the freshest signed data for each beacon.
    const removeCount = Math.max(0, signedDatas.length - 1);
    if (removeCount) {
      logger.debug('Pruning signed data for beacon', { beacon, signedDatas, removeCount });
      signedDataCache[airnode]![templateId] = allSignedDatas.slice(removeCount);
    }
  }
};
