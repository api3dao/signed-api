import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { interpolateSecretsIntoConfig } from '@api3/commons';
import dotenv from 'dotenv';
import { ZodError } from 'zod';

import { config } from '../../test/fixtures';

import { type Config, configSchema, signedApisSchema } from './schema';

test('validates example config', async () => {
  const exampleConfig = JSON.parse(readFileSync(join(__dirname, '../../config/airnode-feed.example.json'), 'utf8'));

  // The mnemonic is not interpolated (and thus invalid).
  await expect(configSchema.parseAsync(exampleConfig)).rejects.toStrictEqual(
    new ZodError([
      {
        code: 'custom',
        message: 'Invalid mnemonic',
        path: ['nodeSettings', 'airnodeWalletMnemonic'],
      },
    ])
  );

  const exampleSecrets = dotenv.parse(readFileSync(join(__dirname, '../../config/secrets.example.env'), 'utf8'));
  await expect(
    configSchema.parseAsync(interpolateSecretsIntoConfig(exampleConfig, exampleSecrets))
  ).resolves.toStrictEqual(expect.any(Object));
});

test('ensures nodeVersion matches Airnode feed version', async () => {
  const invalidConfig: Config = {
    ...config,
    nodeSettings: {
      ...config.nodeSettings,
      nodeVersion: '0.0.1',
    },
  };

  await expect(configSchema.parseAsync(invalidConfig)).rejects.toStrictEqual(
    new ZodError([
      {
        code: 'custom',
        message: 'Invalid node version',
        path: ['nodeSettings', 'nodeVersion'],
      },
    ])
  );
});

test('ensures signed API names are unique', () => {
  expect(() =>
    signedApisSchema.parse([
      { name: 'foo', url: 'https://example.com', authToken: null },
      { name: 'foo', url: 'https://example.com', authToken: null },
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

  expect(signedApisSchema.parse([{ name: 'foo', url: 'https://example.com', authToken: null }])).toStrictEqual([
    {
      name: 'foo',
      url: 'https://example.com',
      authToken: null,
    },
  ]);
});

describe('validateTriggerReferences', () => {
  it('validates template references exist', async () => {
    const notFoundTemplateId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    const invalidConfig: Config = {
      ...config,
      triggers: {
        signedApiUpdates: [
          {
            ...config.triggers.signedApiUpdates[0]!,
            templateIds: [notFoundTemplateId, ...config.triggers.signedApiUpdates[0]!.templateIds],
          },
        ],
      },
    };

    await expect(configSchema.parseAsync(invalidConfig)).rejects.toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: `Template "${notFoundTemplateId}" is not defined in the config.templates object`,
          path: ['triggers', 'signedApiUpdates', 0, 'templateIds', 0],
        },
      ])
    );
  });

  it('validates all templates reference the same endpoint', async () => {
    const endpointName = 'testEndpoint';
    const exampleEndpointId = '0x3cd24fa917796c35f96f67fa123c786485ae72133dc2f4da3299cf99fb245317';
    const exampleTemplateId = '0xd16373affaa5ed2ae5a1f740c48954238ba237e0899e1cf5da97025269ad84cc';

    const invalidConfig: Config = {
      ...config,
      endpoints: {
        ...config.endpoints,
        [exampleEndpointId]: {
          endpointName,
          oisTitle: 'Nodary',
        },
      },
      templates: {
        ...config.templates,
        [exampleTemplateId]: {
          endpointId: exampleEndpointId,
          parameters: [{ type: 'string32', name: 'name', value: 'DIFFERENT' }],
        },
      },
      triggers: {
        signedApiUpdates: [
          {
            ...config.triggers.signedApiUpdates[0]!,
            templateIds: [...config.triggers.signedApiUpdates[0]!.templateIds, exampleTemplateId],
          },
        ],
      },
      ois: [
        {
          ...config.ois[0]!,
          endpoints: [
            ...config.ois[0]!.endpoints,
            {
              fixedOperationParameters: [],
              name: endpointName,
              operation: { method: 'get', path: '/feed/latest' },
              parameters: [{ name: 'name', operationParameter: { in: 'query', name: 'name' } }],
              reservedParameters: [
                { name: '_type', fixed: 'int256' },
                { name: '_times', fixed: '1000000000000000000' },
              ],
            },
          ],
        },
      ],
    };

    await expect(configSchema.parseAsync(invalidConfig)).rejects.toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'The endpoint utilized by each template must be same',
          path: ['triggers', 'signedApiUpdates', 0, 'templateIds'],
        },
      ])
    );
  });

  it('validates operation effects are identical', async () => {
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
          message: 'The endpoint utilized by each template must have the same operation effect',
          path: ['triggers', 'signedApiUpdates', 0, 'templateIds'],
        },
      ])
    );
  });

  it('skips operation effect validation for skip API call endpoints', async () => {
    const skipApiCallConfig: Config = {
      ...config,
      ois: [
        // By removing the pre-processing the triggers will end up with different operation effects.
        {
          ...config.ois[0]!,
          endpoints: [
            {
              ...config.ois[0]!.endpoints[0]!,
              preProcessingSpecifications: undefined,
              operation: undefined,
              fixedOperationParameters: [],
            },
          ],
        },
      ],
    };

    // Should not throw even though the operation effects would be different
    await expect(configSchema.parseAsync(skipApiCallConfig)).resolves.toBeDefined();
  });
});
