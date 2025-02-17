export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export type GetUnsignedDataResponseSchema = {
  count: number;
  data: Record<string /* Beacon ID */, Omit<InternalSignedData, 'signature' | 'beaconId' | 'isOevBeacon'>>;
};

export type GetSignedDataResponseSchema = {
  count: number;
  data: Record<string /* Beacon ID */, Omit<InternalSignedData, 'beaconId' | 'isOevBeacon'>>;
};

export type PostSignedDataResponseSchema = {
  count: number;
  skipped: number;
};

export type GetListAirnodesResponseSchema = { count: number; 'available-airnodes': string[] };

export type GetStatusResponseSchema = {
  stage: string;
  version: string;
  currentTimestamp: string;
  deploymentTimestamp: string;
  configHash: string;
  certifiedAirnodes: string[];
};

export type InternalSignedData = {
  airnode: string;
  templateId: string;
  beaconId: string;
  timestamp: string;
  encodedValue: string;
  signature: string;
  isOevBeacon: boolean;
};
