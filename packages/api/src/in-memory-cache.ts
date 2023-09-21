import { SignedData } from './types';

const signedDataCache: Record<string /* Airnode ID */, Record<string /* Template ID */, SignedData>> = {};

// The API is deliberately asynchronous to mimic a database call.
export const getBy = async (airnodeId: string, templateId: string) => {
  if (!signedDataCache[airnodeId]) return null;
  return signedDataCache[airnodeId]![templateId] ?? null;
};

// The API is deliberately asynchronous to mimic a database call.
export const getAllBy = async (airnodeId: string) => {
  return Object.values(signedDataCache[airnodeId] ?? {});
};

// The API is deliberately asynchronous to mimic a database call.
export const getAll = async () => signedDataCache;

// The API is deliberately asynchronous to mimic a database call.
export const put = async (signedData: SignedData) => {
  signedDataCache[signedData.airnode] = signedDataCache[signedData.airnode] ?? {};
  signedDataCache[signedData.airnode]![signedData.templateId] = signedData;
};

// The API is deliberately asynchronous to mimic a database call.
export const putAll = async (signedDataArray: SignedData[]) => {
  for (const signedData of signedDataArray) await put(signedData);
};
