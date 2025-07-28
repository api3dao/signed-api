import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import dotenv from 'dotenv';

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
    const expectedError = [
      {
        code: 'invalid_format',
        format: 'regex',
        origin: 'string',
        message: 'Must start with a slash and contain only alphanumeric characters and dashes',
        path: ['urlPath'],
        pattern: '/^\\/[\\dA-Za-z-]+$/',
      },
    ];
    expect(
      endpointSchema.safeParse({ urlPath: '', delaySeconds: 0, authTokens: null, isOev: false }).error?.issues
    ).toStrictEqual(expectedError);
    expect(
      endpointSchema.safeParse({ urlPath: '/', delaySeconds: 0, authTokens: null, isOev: false }).error?.issues
    ).toStrictEqual(expectedError);
    expect(
      endpointSchema.safeParse({ urlPath: 'url-path', delaySeconds: 0, authTokens: null, isOev: false }).error?.issues
    ).toStrictEqual(expectedError);

    expect(() =>
      endpointSchema.parse({ urlPath: '/url-path', delaySeconds: 0, authTokens: null, isOev: false })
    ).not.toThrow();
  });
});

describe('endpointsSchema', () => {
  it('ensures each urlPath is unique', () => {
    expect(
      endpointsSchema.safeParse([
        { urlPath: '/url-path', delaySeconds: 0, authTokens: null, isOev: false },
        { urlPath: '/url-path', delaySeconds: 0, authTokens: null, isOev: false },
      ]).error?.issues
    ).toStrictEqual([
      {
        code: 'custom',
        message: 'Each "urlPath" of an endpoint must be unique',
        path: [],
      },
    ]);
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

    const expectedIssues = [
      {
        code: 'invalid_union',
        errors: [
          [
            {
              code: 'invalid_value',
              path: [],
              message: 'Invalid input: expected "true"',
              values: ['true'],
            },
          ],
          [
            {
              code: 'invalid_value',
              path: [],
              message: 'Invalid input: expected "false"',
              values: ['false'],
            },
          ],
        ],
        path: [],
        message: 'Invalid input',
      },
    ];
    expect(envBooleanSchema.safeParse('').error?.issues).toStrictEqual(expectedIssues);
    expect(envBooleanSchema.safeParse('off').error?.issues).toStrictEqual(expectedIssues);
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

    expect(envConfigSchema.safeParse(env).error?.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'The AWS_REGION must be set when CONFIG_SOURCE is "aws-s3"',
        path: ['AWS_REGION'],
      },
    ]);
  });
});

describe('allowed Airnodes schema', () => {
  it('accepts valid configuration', () => {
    const allValid = allowedAirnodesSchema.parse('*');
    expect(allValid).toBe('*');

    expect(() =>
      allowedAirnodesSchema.parse([
        { address: '0xB47E3D8734780430ee6EfeF3c5407090601Dcd15', isCertified: true, authTokens: ['token1'] },
        { address: '0xE1d8E71195606Ff69CA33A375C31fe763Db97B11', isCertified: false, authTokens: null },
      ])
    ).not.toThrow();
  });

  it('disallows empty list', () => {
    expect(allowedAirnodesSchema.safeParse([]).error?.issues).toStrictEqual([
      {
        code: 'too_small',
        origin: 'array',
        minimum: 1,
        inclusive: true,
        message: 'Too small: expected array to have >=1 items',
        path: [],
      },
    ]);
  });
});
