import { readFileSync } from 'fs';
import { join } from 'path';
import { ZodError } from 'zod';
import { configSchema, endpointSchema, endpointsSchema } from './schema';

describe('endpointSchema', () => {
  it('validates urlPath', () => {
    const expectedError = new ZodError([
      {
        validation: 'regex',
        code: 'invalid_string',
        message: 'Must start with a slash and contain only alphanumeric characters and dashes',
        path: ['urlPath'],
      },
    ]);
    expect(() => endpointSchema.parse({ urlPath: '', delaySeconds: 0 })).toThrow(expectedError);
    expect(() => endpointSchema.parse({ urlPath: '/', delaySeconds: 0 })).toThrow(expectedError);
    expect(() => endpointSchema.parse({ urlPath: 'url-path', delaySeconds: 0 })).toThrow(expectedError);
    expect(() => endpointSchema.parse({ urlPath: 'url-path', delaySeconds: 0 })).toThrow(expectedError);

    expect(() => endpointSchema.parse({ urlPath: '/url-path', delaySeconds: 0 })).not.toThrow();
  });
});

describe('endpointsSchema', () => {
  it('ensures each urlPath is unique', () => {
    expect(() =>
      endpointsSchema.parse([
        { urlPath: '/url-path', delaySeconds: 0 },
        { urlPath: '/url-path', delaySeconds: 0 },
      ])
    ).toThrow(
      new ZodError([
        {
          code: 'custom',
          message: 'Each "urlPath" of an endpoint must be unique',
          path: [],
        },
      ])
    );
  });
});

describe('configSchema', () => {
  it('validates example config', () => {
    const config = JSON.parse(readFileSync(join(__dirname, '../config/signed-api.example.json'), 'utf8'));

    expect(() => configSchema.parse(config)).not.toThrow();
  });
});
