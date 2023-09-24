import { last } from 'lodash';
import { isIgnored } from './utils';
import { SignedData } from './schema';
import { getCache } from './cache';

// TODO: Tests

const ignoreTooFreshData = (signedDatas: SignedData[], ignoreAfterTimestamp: number) =>
  signedDatas.filter((data) => !isIgnored(data, ignoreAfterTimestamp));

// The API is deliberately asynchronous to mimic a database call.
export const get = async (airnodeId: string, templateId: string, ignoreAfterTimestamp: number) => {
  const signedDataCache = getCache();
  if (!signedDataCache[airnodeId]) return null;
  const signedDatas = signedDataCache[airnodeId]![templateId];
  if (!signedDatas) return null;

  return last(ignoreTooFreshData(signedDatas, ignoreAfterTimestamp)) ?? null;
};

// The API is deliberately asynchronous to mimic a database call.
export const getAll = async (airnodeId: string, ignoreAfterTimestamp: number) => {
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
export const getAllAirnodeAddresses = async () => Object.keys(getCache());

// The API is deliberately asynchronous to mimic a database call.
export const put = async (signedData: SignedData) => {
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

// TODO: Tests that it inserts in correct order.
// The API is deliberately asynchronous to mimic a database call.
export const putAll = async (signedDataArray: SignedData[]) => {
  for (const signedData of signedDataArray) await put(signedData);
};
