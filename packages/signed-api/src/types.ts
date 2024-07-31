import { type SignedData } from './schema';

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export type GetUnsignedDataResponseSchema = {
  count: number;
  data: Record<string /* Beacon ID */, Omit<SignedData, 'signature' | 'beaconId'>>;
};

export type GetSignedDataResponseSchema = {
  count: number;
  data: Record<string /* Beacon ID */, Omit<SignedData, 'beaconId'>>;
};

export type PostSignedDataResponseSchema = {
  count: number;
  skipped: number;
};

export type GetListAirnodesResponseSchema = { count: number; 'available-airnodes': string[] };
