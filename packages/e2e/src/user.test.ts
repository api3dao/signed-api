import { go } from '@api3/promise-utils';
import axios from 'axios';

import { airnode, formatData } from './utils';

test('respects the delay', async () => {
  const start = Date.now();
  let [realCount, delayedCount] = [0, 0];

  while (Date.now() - start < 15_000) {
    const realTimeResponse = await axios.get(`http://localhost:8090/real-time/${airnode}`);
    const realTimeData = formatData(realTimeResponse.data);
    const delayedResponse = await axios.get(`http://localhost:8090/delayed/${airnode}`);
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

  const goPostData = await go(async () =>
    axios.post(`http://localhost:8090`, Array.from({ length: 100_000 }).fill(signedData))
  );

  expect(goPostData.success).toBe(false);
  const error = goPostData.error as any;
  expect(error.message).toBe('Request failed with status code 413');
  expect(error.response.status).toBe(413);
  expect(error.response.data).toStrictEqual({
    error: { message: 'request entity too large' },
  });
});
