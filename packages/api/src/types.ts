import { z } from 'zod';

/**
 * Common EVM Data Schema
 */
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

export const batchSignedDataSchema = z.array(signedDataSchema);

export type SignedData = z.infer<typeof signedDataSchema>;
export type BatchSignedData = z.infer<typeof batchSignedDataSchema>;

export interface PromiseError<T> extends Error {
  reason: T;
}
