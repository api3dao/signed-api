import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import dotenv from 'dotenv';
import { ZodError } from 'zod';

import {
  allowedAirnodesSchema,
  configSchema,
  endpointSchema,
  endpointsSchema,
  envBooleanSchema,
  envConfigSchema,
} from './schema';

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

describe('env config schema', () => {
  it('parses boolean env variable correctly', () => {
    expect(envBooleanSchema.parse('true')).toBe(true);
    expect(envBooleanSchema.parse('false')).toBe(false);

    // Using a function to create the expected error because the error message length is too long to be inlined. The
    // error messages is trivially stringified if propagated to the user.
    const createExpectedError = (received: string) =>
      new ZodError([
        {
          code: 'invalid_union',
          unionErrors: [
            new ZodError([
              {
                received,
                code: 'invalid_literal',
                expected: 'true',
                path: [],
                message: 'Invalid literal value, expected "true"',
              },
            ]),
            new ZodError([
              {
                received,
                code: 'invalid_literal',
                expected: 'false',
                path: [],
                message: 'Invalid literal value, expected "false"',
              },
            ]),
          ],
          path: [],
          message: 'Invalid input',
        },
      ]);
    expect(() => envBooleanSchema.parse('')).toThrow(createExpectedError(''));
    expect(() => envBooleanSchema.parse('off')).toThrow(createExpectedError('off'));
  });

  it('parses example env correctly', () => {
    // Load the example configuration from the ".env.example" file
    const env = dotenv.parse(readFileSync(join(__dirname, '../.env.example'), 'utf8'));

    expect(() => envConfigSchema.parse(env)).not.toThrow();
  });

  it('the AWS_REGION is set when CONFIG_SOURCE is aws-s3', () => {
    const env = {
      CONFIG_SOURCE: 'aws-s3',
    };

    expect(() => envConfigSchema.parse(env)).toThrow(
      new ZodError([
        {
          code: 'custom',
          message: 'The AWS_REGION must be set when CONFIG_SOURCE is "aws-s3"',
          path: ['AWS_REGION'],
        },
      ])
    );
  });
});

describe('allowed Airnodes schema', () => {
  it('accepts valid configuration', () => {
    const allValid = allowedAirnodesSchema.parse('*');
    expect(allValid).toBe('*');

    expect(
      allowedAirnodesSchema.parse([
        '0xB47E3D8734780430ee6EfeF3c5407090601Dcd15',
        '0xE1d8E71195606Ff69CA33A375C31fe763Db97B11',
      ])
    ).toStrictEqual(['0xB47E3D8734780430ee6EfeF3c5407090601Dcd15', '0xE1d8E71195606Ff69CA33A375C31fe763Db97B11']);
  });

  it('disallows empty list', () => {
    expect(() => allowedAirnodesSchema.parse([])).toThrow(
      new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'array',
          inclusive: true,
          exact: false,
          message: 'Array must contain at least 1 element(s)',
          path: [],
        },
      ])
    );
  });
});
