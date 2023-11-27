import { createResponseHeaders } from './headers';

describe(createResponseHeaders.name, () => {
  it('returns common headers when cache is not set', () => {
    const expectedHeaders = {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': '*',
    };
    expect(createResponseHeaders()).toStrictEqual(expectedHeaders);
  });

  it('returns browser cache headers when cache type is browser', () => {
    const expectedHeaders = {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': '*',
      'cache-control': 'max-age=3600',
    };
    expect(
      createResponseHeaders({
        type: 'browser',
        maxAgeSeconds: 3600,
      })
    ).toStrictEqual(expectedHeaders);
  });

  it('returns CDN cache headers when cache type is cdn', () => {
    const expectedHeaders = {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': '*',
      'cache-control': 'no-store',
      'cdn-cache-control': 'max-age=3600',
    };
    expect(
      createResponseHeaders({
        type: 'cdn',
        maxAgeSeconds: 3600,
      })
    ).toStrictEqual(expectedHeaders);
  });
});
