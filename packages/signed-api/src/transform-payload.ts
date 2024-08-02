import { deriveOevTemplateId, type SignedApiBatchPayloadV1, type SignedApiBatchPayloadV2 } from '@api3/airnode-feed';
import { deriveBeaconId, type Hex } from '@api3/commons';

import { getCache, setCache } from './in-memory-cache';
import { type InternalSignedData } from './schema';

export const getOevTemplateId = (templateId: string) => {
  const cache = getCache();
  if (templateId in cache.templateIdToOevTemplateId) {
    return cache.templateIdToOevTemplateId[templateId]!;
  }

  const oevTemplateId = deriveOevTemplateId(templateId);
  setCache({
    ...cache,
    templateIdToOevTemplateId: { ...cache.templateIdToOevTemplateId, [templateId]: oevTemplateId },
  });
  return oevTemplateId;
};

export const getBeaconId = (airnode: string, templateId: string) => {
  const cache = getCache();
  if (cache.airnodeToTemplateIdToBeaconId[airnode]?.[templateId]) {
    return cache.airnodeToTemplateIdToBeaconId[airnode][templateId];
  }

  const beaconId = deriveBeaconId(airnode as Hex, templateId as Hex);
  setCache({
    ...cache,
    airnodeToTemplateIdToBeaconId: {
      ...cache.airnodeToTemplateIdToBeaconId,
      [airnode]: { ...cache.airnodeToTemplateIdToBeaconId[airnode], [templateId]: beaconId },
    },
  });
  return beaconId;
};

export const transformAirnodeFeedPayload = (
  payload: SignedApiBatchPayloadV1 | SignedApiBatchPayloadV2
): InternalSignedData[] => {
  if ('airnode' in payload) {
    const { airnode } = payload;
    return payload.signedData.flatMap((data) => {
      const { templateId, encodedValue, oevSignature, signature, timestamp } = data;
      const oevTemplateId = getOevTemplateId(templateId);
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
