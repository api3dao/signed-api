import { last, uniqBy } from 'lodash';

import { logger } from './logger';
import { type InternalSignedData } from './types';
import { isIgnored } from './utils';

type SignedDataCache = Record<
  string, // Airnode address.
  Record<
    string, // Template ID.
    InternalSignedData[] // Signed data is ordered by timestamp (oldest first).
  >
>;

export type Cache = {
  // The signed data stored internally.
  signedDataCache: SignedDataCache;
  // Mapping for template ID to their OEV counterparts. The OEV template ID is hashed from the original template ID and
  // is cached for performance reasons.
  templateIdToOevTemplateId: Record<string, string>;
  // Beacon IDs are precomputed as a performance optimization.
  airnodeToTemplateIdToBeaconId: Record<
    string /* Airnode address */,
    Record<string /* Template ID */, string /* Beacon ID */>
  >;
};

export const getInitialCache = (): Cache => ({
  signedDataCache: {},
  templateIdToOevTemplateId: {},
  airnodeToTemplateIdToBeaconId: {},
});

let cache: Cache = getInitialCache();

// Making this a getter function makes it easier to mock the cache in storage.
export const getCache = () => cache;

export const setCache = (newCache: Cache) => {
  cache = newCache;
};

export const ignoreTooFreshData = (signedDatas: InternalSignedData[], ignoreAfterTimestamp: number) =>
  signedDatas.filter((data) => !isIgnored(data, ignoreAfterTimestamp));

export const get = (airnodeAddress: string, templateId: string, ignoreAfterTimestamp: number) => {
  const cache = getCache();
  if (!cache.signedDataCache[airnodeAddress]) return null;
  const signedDatas = cache.signedDataCache[airnodeAddress]![templateId];
  if (!signedDatas) return null;

  return last(ignoreTooFreshData(signedDatas, ignoreAfterTimestamp)) ?? null;
};

// The API is deliberately asynchronous to mimic a database call.
export const getAll = (airnodeAddress: string, ignoreAfterTimestamp: number, isOev: boolean) => {
  logger.debug('Getting all signed data.', { airnodeAddress, ignoreAfterTimestamp, isOev });

  const cache = getCache();
  const signedDataByTemplateId = cache.signedDataCache[airnodeAddress] ?? {};
  const freshestSignedData: InternalSignedData[] = [];
  for (const templateId of Object.keys(signedDataByTemplateId)) {
    if (
      signedDataByTemplateId[templateId]!.length === 0 ||
      // Whether the beacon is an OEV beacon depends on the template ID, so we can just check the first one.
      signedDataByTemplateId[templateId]![0]!.isOevBeacon !== isOev
    ) {
      continue;
    }

    const freshest = get(airnodeAddress, templateId, ignoreAfterTimestamp);
    if (freshest) freshestSignedData.push(freshest);
  }

  return freshestSignedData;
};

// The Airnode addresses are returned independently of how old the data is. This means that an API can get all Airnode
// addresses and then use a delayed endpoint to get data from each, but fail to get data from some of them.
export const getAllAirnodeAddresses = () => {
  logger.debug('Getting all Airnode addresses.');

  return Object.keys(getCache().signedDataCache);
};

export const put = (signedData: InternalSignedData) => {
  const cache = getCache();
  const { airnode, templateId, timestamp } = signedData;
  cache.signedDataCache[airnode] ??= {};
  cache.signedDataCache[airnode]![templateId] ??= [];

  // We need to insert the signed data in the correct position in the array based on the timestamp. It would be more
  // efficient to use a priority queue, but the proper solution is not to store the data in memory.
  const signedDatas = cache.signedDataCache[airnode]![templateId]!;
  const index = signedDatas.findIndex((data) => Number.parseInt(data.timestamp, 10) > Number.parseInt(timestamp, 10));
  if (index === -1) signedDatas.push(signedData);
  else signedDatas.splice(index, 0, signedData);
};

export const putAll = (signedDataArray: InternalSignedData[]) => {
  for (const signedData of signedDataArray) put(signedData);
};

// Removes all signed data that is no longer needed to be kept in memory (because it is too old and there exist a newer
// signed data for each endpoint). The function is intended to be called after each insertion of new signed data for
// performance reasons, because it only looks to prune the data that for beacons that have been just inserted.
export const prune = (signedDataArray: InternalSignedData[], maxIgnoreAfterTimestamp: number) => {
  const beaconsToPrune = uniqBy(signedDataArray, 'beaconId');
  logger.debug('Pruning signed data.', { maxIgnoreAfterTimestamp });
  const cache = getCache();

  for (const beacon of beaconsToPrune) {
    const { airnode, templateId } = beacon;
    const allSignedDatas = cache.signedDataCache[airnode]![templateId]!; // Assume the data is inserted the cache.
    const signedDatas = ignoreTooFreshData(allSignedDatas, maxIgnoreAfterTimestamp);

    // It is enough to keep only the freshest signed data for each beacon.
    const removeCount = Math.max(0, signedDatas.length - 1);
    if (removeCount) {
      logger.debug('Pruning signed data for beacon.', { beacon, signedDatas, removeCount });
      cache.signedDataCache[airnode]![templateId] = allSignedDatas.slice(removeCount);
    }
  }
};
