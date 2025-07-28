import { type LogFormat, logFormatOptions, logLevelOptions, type LogLevel } from '@api3/commons';
import { goSync } from '@api3/promise-utils';
import { ethers } from 'ethers';
import { uniqBy } from 'lodash';
import { z } from 'zod';

import packageJson from '../package.json';

export const evmAddressSchema = z.string().transform((val, ctx) => {
  const goChecksumAddress = goSync(() => ethers.utils.getAddress(val));
  if (!goChecksumAddress.success) {
    ctx.issues.push({
      code: 'custom',
      message: 'Invalid EVM address',
      path: [],
      input: val,
    });
    return '';
  }
  return goChecksumAddress.data;
});

export const evmIdSchema = z.string().regex(/^0x[\dA-Fa-f]{64}$/, 'Must be a valid EVM ID');

export const endpointSchema = z.strictObject({
  urlPath: z
    .string()
    .regex(/^\/[\dA-Za-z-]+$/, 'Must start with a slash and contain only alphanumeric characters and dashes'),
  authTokens: z.array(z.string()).nonempty().nullable(),
  delaySeconds: z.number().nonnegative().int(),
  hideSignatures: z.boolean().default(false),
  isOev: z.boolean(),
});

export type Endpoint = z.infer<typeof endpointSchema>;

export const endpointsSchema = z
  .array(endpointSchema)
  .refine(
    (endpoints) => uniqBy(endpoints, 'urlPath').length === endpoints.length,
    'Each "urlPath" of an endpoint must be unique'
  );

const allowedAirnodeSchema = z.strictObject({
  address: evmAddressSchema,
  authTokens: z.array(z.string()).nonempty().nullable(),
  isCertified: z.boolean(),
});

export type AllowedAirnode = z.infer<typeof allowedAirnodeSchema>;

export const allowedAirnodesSchema = z.union([z.literal('*'), z.array(allowedAirnodeSchema).nonempty()]);

export type AllowedAirnodes = z.infer<typeof allowedAirnodesSchema>;

export const cacheSchema = z.strictObject({
  type: z.union([z.literal('browser'), z.literal('cdn')]),
  maxAgeSeconds: z.number().nonnegative().int(),
});

export type Cache = z.infer<typeof cacheSchema>;

export const configSchema = z.strictObject({
  endpoints: endpointsSchema,
  cache: cacheSchema.optional(),
  allowedAirnodes: allowedAirnodesSchema,
  stage: z
    .string()
    .regex(/^[\da-z-]{1,256}$/, 'Only lowercase letters, numbers and hyphens are allowed (max 256 characters)'),
  version: z.string().refine((version) => version === packageJson.version, 'Invalid Signed API version'),
});

export type Config = z.infer<typeof configSchema>;

export const envBooleanSchema = z.union([z.literal('true'), z.literal('false')]).transform((val) => val === 'true');

// We apply default values to make it convenient to omit certain environment variables. The default values should be
// primarily focused on users and production usage.
export const envConfigSchema = z
  // Intentionally not using strictObject here because we want to allow other environment variables to be present.
  .object({
    LOG_API_DATA: envBooleanSchema.default(false),
    LOG_COLORIZE: envBooleanSchema.default(false),
    LOG_FORMAT: z
      .string()
      .transform((value, ctx) => {
        if (!logFormatOptions.includes(value as any)) {
          ctx.issues.push({
            code: 'custom',
            message: 'Invalid LOG_FORMAT',
            path: ['LOG_FORMAT'],
            input: value,
          });
          return;
        }

        return value as LogFormat;
      })
      .default('json'),
    LOG_LEVEL: z
      .string()
      .transform((value, ctx) => {
        if (!logLevelOptions.includes(value as any)) {
          ctx.issues.push({
            code: 'custom',
            message: 'Invalid LOG_LEVEL',
            path: ['LOG_LEVEL'],
            input: value,
          });
          return;
        }

        return value as LogLevel;
      })
      .default('info'),
    LOGGER_ENABLED: envBooleanSchema.default(true),

    CONFIG_SOURCE: z.union([z.literal('local'), z.literal('aws-s3')]).default('local'),

    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_REGION: z.string().optional(),
    AWS_S3_BUCKET_NAME: z.string().optional(),
    AWS_S3_BUCKET_PATH: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .strip() // We parse from ENV variables of the process which has many variables that we don't care about.
  .check((ctx) => {
    const env = ctx.value;
    if (env.CONFIG_SOURCE === 'aws-s3' && !env.AWS_REGION) {
      ctx.issues.push({
        code: 'custom',
        message: 'The AWS_REGION must be set when CONFIG_SOURCE is "aws-s3"',
        path: ['AWS_REGION'],
        input: env,
      });
    }
  });

export type EnvConfig = z.infer<typeof envConfigSchema>;
