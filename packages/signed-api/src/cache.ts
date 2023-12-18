import type { SignedData } from './schema';

type SignedDataCache = Record<
  string, // Airnode address.
  Record<
    string, // Template ID.
    SignedData[] // Signed data is ordered by timestamp (oldest first).
  >
>;

let signedDataCache: SignedDataCache = {};

// Making this a getter function makes it easier to mock the cache in storage.
export const getCache = () => signedDataCache;

export const setCache = (cache: SignedDataCache) => {
  signedDataCache = cache;
};
