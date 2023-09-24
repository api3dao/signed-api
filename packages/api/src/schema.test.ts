import { readFileSync } from 'fs';
import { join } from 'path';
import { ZodError } from 'zod';
import { configSchema, endpointSchema } from './schema';

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

describe('configSchema', () => {
  it('validates example config', () => {
    const config = JSON.parse(readFileSync(join(__dirname, '../config/signed-api.example.json'), 'utf8'));

    expect(() => configSchema.parse(config)).not.toThrow();
  });
});
