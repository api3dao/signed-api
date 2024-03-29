import type { Cache } from './schema';

const COMMON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': '*',
};

export const createResponseHeaders = (cache?: Cache | undefined) => {
  if (!cache) return COMMON_HEADERS;

  const { type, maxAgeSeconds } = cache;
  switch (type) {
    case 'browser': {
      return {
        ...COMMON_HEADERS,
        'cache-control': `max-age=${maxAgeSeconds}`,
      };
    }
    case 'cdn': {
      return {
        ...COMMON_HEADERS,
        'cache-control': `max-age=${maxAgeSeconds}`, // It does not hurt to set the browser cache as well.
        'cdn-cache-control': `max-age=${maxAgeSeconds}`,
      };
    }
  }
};
