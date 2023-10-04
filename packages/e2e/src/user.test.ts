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
