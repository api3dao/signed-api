import { deriveOevTemplateId, type SignedApiBatchPayloadV1, type SignedApiBatchPayloadV2 } from '@api3/airnode-feed';
import { deriveBeaconId, type Hex } from '@api3/commons';

import { getCache } from './in-memory-cache';
import { type InternalSignedData } from './types';

// The payload is not verified yet, so the OEV template ID is memoized only when the template already has verified
// signed data in the cache. Otherwise, any payload could grow the memo.
export const getOevTemplateId = (airnode: string, templateId: string) => {
  const cache = getCache();
  if (templateId in cache.templateIdToOevTemplateId) return cache.templateIdToOevTemplateId[templateId]!;

  const oevTemplateId = deriveOevTemplateId(templateId);
  if (cache.signedDataCache[airnode]?.[templateId]) cache.templateIdToOevTemplateId[templateId] = oevTemplateId;
  return oevTemplateId;
};

// The cache contains only verified signed data, so the beacon ID stored there can be reused instead of deriving it.
export const getBeaconId = (airnode: string, templateId: string) =>
  getCache().signedDataCache[airnode]?.[templateId]?.[0]?.beaconId ?? deriveBeaconId(airnode as Hex, templateId as Hex);

export const transformAirnodeFeedPayload = (
  payload: SignedApiBatchPayloadV1 | SignedApiBatchPayloadV2
): InternalSignedData[] => {
  // Check whether the payload is v2 and process the payload to the internal format. The v2 Airnode feed pushes beacon
  // data and signatures for base feed updates (regular updates done by Airseeker) and OEV signatures, which are
  // purchasable via OEV auctions.
  if ('airnode' in payload) {
    const { airnode } = payload;
    return payload.signedData.flatMap((data) => {
      const { templateId, encodedValue, oevSignature, signature, timestamp } = data;
      const oevTemplateId = getOevTemplateId(airnode, templateId);
      return [
        {
          airnode,
          beaconId: getBeaconId(airnode, templateId),
          encodedValue,
          signature,
          templateId,
          timestamp,
          isOevBeacon: false,
        },
        {
          airnode,
          beaconId: getBeaconId(airnode, oevTemplateId),
          encodedValue,
          signature: oevSignature,
          templateId: oevTemplateId,
          timestamp,
          isOevBeacon: true,
        },
      ];
    });
  }

  // Airnode feed v1 does not send the data for OEV beacons.
  return payload.map((data) => ({ ...data, isOevBeacon: false }));
};
