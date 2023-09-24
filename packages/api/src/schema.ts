import { z } from 'zod';

export const endpointSchema = z
  .object({
    urlPath: z
      .string()
      .regex(/^\/[a-zA-Z0-9\-]+$/, 'Must start with a slash and contain only alphanumeric characters and dashes'),
    delaySeconds: z.number().nonnegative().int(),
  })
  .strict();

export type Endpoint = z.infer<typeof endpointSchema>;

export const configSchema = z
  .object({
    endpoints: z.array(endpointSchema),
    maxBatchSize: z.number().nonnegative().int(),
    port: z.number().nonnegative().int(),
  })
  .strict();

export type Config = z.infer<typeof configSchema>;

// TODO: add tests for lines below, better error messages
export const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const evmIdSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

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
