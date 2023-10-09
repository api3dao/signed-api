import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import dotenv from 'dotenv';
import { ZodError } from 'zod';

import { config } from '../../test/fixtures';

import { type Config, configSchema, signedApisSchema } from './schema';
import { interpolateSecrets } from './utils';

test('validates example config', async () => {
  const exampleConfig = JSON.parse(readFileSync(join(__dirname, '../../config/pusher.example.json'), 'utf8'));

  // The mnemonic is not interpolated (and thus invalid).
  await expect(configSchema.parseAsync(exampleConfig)).rejects.toStrictEqual(
    new ZodError([
      {
        code: 'custom',
        message: 'Invalid mnemonic',
        path: ['airnodeWalletMnemonic'],
      },
    ])
  );

  const exampleSecrets = dotenv.parse(readFileSync(join(__dirname, '../../config/secrets.example.env'), 'utf8'));
  await expect(configSchema.parseAsync(interpolateSecrets(exampleConfig, exampleSecrets))).resolves.toStrictEqual(
    expect.any(Object)
  );
});

test('ensures signed API names are unique', () => {
  expect(() =>
    signedApisSchema.parse([
      { name: 'foo', url: 'https://example.com' },
      { name: 'foo', url: 'https://example.com' },
    ])
  ).toThrow(
    new ZodError([
      {
        code: 'custom',
        message: 'Signed API names must be unique',
        path: ['signedApis'],
      },
    ])
  );

  expect(signedApisSchema.parse([{ name: 'foo', url: 'https://example.com' }])).toStrictEqual([
    {
      name: 'foo',
      url: 'https://example.com',
    },
  ]);
});

test('validates trigger references', async () => {
  const invalidConfig: Config = {
    ...config,
    ois: [
      // By removing the pre-processing the triggers will end up with different operation effects.
      { ...config.ois[0]!, endpoints: [{ ...config.ois[0]!.endpoints[0]!, preProcessingSpecifications: undefined }] },
    ],
  };

  await expect(configSchema.parseAsync(invalidConfig)).rejects.toStrictEqual(
    new ZodError([
      {
        code: 'custom',
        message:
          'If beaconIds contains more than 1 beacon, the endpoint utilized by each beacons must have same operation effect',
        path: ['triggers', 'signedApiUpdates', 0],
      },
    ])
  );
});
