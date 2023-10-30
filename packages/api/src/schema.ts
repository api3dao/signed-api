import { type LogFormat, logFormatOptions, logLevelOptions, type LogLevel } from '@api3/commons';
import { uniqBy } from 'lodash';
import { z } from 'zod';

export const evmAddressSchema = z.string().regex(/^0x[\dA-Fa-f]{40}$/, 'Must be a valid EVM address');

export const evmIdSchema = z.string().regex(/^0x[\dA-Fa-f]{64}$/, 'Must be a valid EVM hash');

export const endpointSchema = z
  .object({
    urlPath: z
      .string()
      .regex(/^\/[\dA-Za-z-]+$/, 'Must start with a slash and contain only alphanumeric characters and dashes'),
    delaySeconds: z.number().nonnegative().int(),
  })
  .strict();

export type Endpoint = z.infer<typeof endpointSchema>;

export const endpointsSchema = z
  .array(endpointSchema)
  .refine(
    (endpoints) => uniqBy(endpoints, 'urlPath').length === endpoints.length,
    'Each "urlPath" of an endpoint must be unique'
  );

export const allowedAirnodesSchema = z.union([z.literal('all'), z.array(evmAddressSchema)]);

export const configSchema = z
  .object({
    endpoints: endpointsSchema,
    maxBatchSize: z.number().nonnegative().int(),
    port: z.number().nonnegative().int(),
    cache: z.object({
      maxAgeSeconds: z.number().nonnegative().int(),
    }),
    allowedAirnodes: allowedAirnodesSchema,
  })
  .strict();

export type Config = z.infer<typeof configSchema>;

export const signedDataSchema = z.object({
  airnode: evmAddressSchema,
  templateId: evmIdSchema,
  beaconId: evmIdSchema,
  timestamp: z.string(),
  encodedValue: z.string(),
  signature: z.string(),
});

export type SignedData = z.infer<typeof signedDataSchema>;

export const batchSignedDataSchema = z.array(signedDataSchema);

export type BatchSignedData = z.infer<typeof batchSignedDataSchema>;

export const envBooleanSchema = z.union([z.literal('true'), z.literal('false')]).transform((val) => val === 'true');

// We apply default values to make it convenient to omit certain environment variables. The default values should be
// primarily focused on users and production usage.
export const envConfigSchema = z
  .object({
    LOG_COLORIZE: envBooleanSchema.default('false'),
    LOG_FORMAT: z
      .string()
      .transform((value, ctx) => {
        if (!logFormatOptions.includes(value as any)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid LOG_FORMAT',
            path: ['LOG_FORMAT'],
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
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid LOG_LEVEL',
            path: ['LOG_LEVEL'],
          });
          return;
        }

        return value as LogLevel;
      })
      .default('info'),
    LOGGER_ENABLED: envBooleanSchema.default('true'),

    CONFIG_SOURCE: z.union([z.literal('local'), z.literal('aws-s3')]).default('local'),

    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_REGION: z.string().optional(),
    AWS_S3_BUCKET_NAME: z.string().optional(),
    AWS_S3_BUCKET_PATH: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .strip() // We parse from ENV variables of the process which has many variables that we don't care about.
  .superRefine((val, ctx) => {
    if (val.CONFIG_SOURCE === 'aws-s3' && !val.AWS_REGION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The AWS_REGION must be set when CONFIG_SOURCE is "aws-s3"',
        path: ['AWS_REGION'],
      });
    }
  });

export type EnvConfig = z.infer<typeof envConfigSchema>;
