import { deriveOevTemplateId } from '@api3/airnode-feed';
import { deriveBeaconId, executeRequest, type Hex } from '@api3/commons';
import { type GetSignedDataResponseSchema } from '@api3/signed-api';
import { ethers } from 'ethers';

import { airnode, createSignedData, formatData } from '../src/utils';

test('respects the delay', async () => {
  const start = Date.now();
  let [realCount, delayedCount] = [0, 0];

  while (Date.now() - start < 15_000) {
    const realTimeResponse = await executeRequest({
      method: 'get',
      url: `http://localhost:8090/real-time/${airnode}`,
      headers: { Authorization: `Bearer some-secret-token` },
    });
    const realTimeData = formatData(realTimeResponse.data);
    const delayedResponse = await executeRequest({ method: 'get', url: `http://localhost:8090/delayed/${airnode}` });
    const delayedData = formatData(delayedResponse.data);

    for (const data of realTimeData) {
      expect(data.delay).toBeGreaterThan(0);
      realCount++;
    }
    for (const data of delayedData) {
      expect(data.delay).toBeGreaterThan(10_000);
      delayedCount++;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  expect(realCount).toBeGreaterThan(0);
  expect(delayedCount).toBeGreaterThan(0);
}, 20_000);

test('ensures Signed API handles requests with huge payloads', async () => {
  const signedData = {
    signature:
      '0x1ea0a64100431adf033ec730547cd3ffd253dd5991336b3d9b9e8dcfe68d82a61bcd9b8b677557a90a025c19ebde1d98608e2fa3462457bb6fe62675518f7f9c1c',
    timestamp: '1701419743',
    templateId: '0x031487ca600cd3a26a39206b5b4373f9231f75e4bd23edeb3d5bdc513c147e2a',
    encodedValue: '0x000000000000000000000000000000000000000000000003d026ef5a02753000',
    airnode: '0x198539e151Fc2CF7642BFfe95B2b7a3Dc08bE0b7',
  };

  const requestResult = await executeRequest({
    method: 'post',
    url: `http://localhost:8090`,
    body: Array.from({ length: 100_000 }).fill(signedData),
  });

  expect(requestResult.success).toBe(false);
  const error = requestResult.errorData!;
  expect(error.message).toBe('Request failed with status code 413');
  expect(error.code).toBe('ERR_BAD_REQUEST');
  expect(error.response).toStrictEqual({
    error: { message: 'request entity too large' },
  });
});

test('handles both EIP-55 and lowercased addresses', async () => {
  const airnodeWallet = new ethers.Wallet('28975fdc5c339153fca3c4cb734b1b00bf4176a770d6f60fdc202d03d1ca61bb');
  const airnode = airnodeWallet.address;
  const lowercaseAirnode = airnode.toLowerCase();
  const timestamp = (Math.floor(Date.now() / 1000) - 60).toString(); // 1 min ago
  const signedData = await createSignedData(airnodeWallet, timestamp);
  await executeRequest({ method: 'post', url: `http://localhost:8090/${airnode}`, body: [signedData] });

  const eip55AirnodeResponse = await executeRequest({ method: 'get', url: `http://localhost:8090/delayed/${airnode}` });
  const lowercasedAirnodeResponse = await executeRequest({
    method: 'get',
    url: `http://localhost:8090/delayed/${lowercaseAirnode}`,
  });

  expect(eip55AirnodeResponse.data).toStrictEqual(lowercasedAirnodeResponse.data);
});

test.only('returns OEV beacons from OEV endpoint', async () => {
  const realTimeBaseBeaconsResponse = await executeRequest({
    method: 'get',
    url: `http://localhost:8090/real-time/${airnode}`,
    headers: { Authorization: `Bearer some-secret-token` },
  });
  const realTimeOevBeaconsResponse = await executeRequest({
    method: 'get',
    url: `http://localhost:8090/real-time-oev/${airnode}`,
    headers: { Authorization: `Bearer some-secret-token` },
  });
  const realTimeBaseBeacons = realTimeBaseBeaconsResponse.data as GetSignedDataResponseSchema;
  const realTimeOevBeacons = realTimeOevBeaconsResponse.data as GetSignedDataResponseSchema;

  expect(realTimeBaseBeacons.count).toBe(realTimeOevBeacons.count);
  // Verify that the OEV beacon IDs returned match the base feed beacons.
  expect(Object.keys(realTimeOevBeacons.data).toSorted()).toStrictEqual(
    Object.values(realTimeBaseBeacons.data)
      .map((data) => deriveOevTemplateId(data.templateId))
      .map((oevTemplateId) => deriveBeaconId(airnode as Hex, oevTemplateId as Hex))
      .toSorted()
  );
});
