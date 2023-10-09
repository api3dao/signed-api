import express from 'express';

import { logger } from './logger';

const app = express();
const PORT = 9876 || process.env.PORT;

interface Asset {
  value: number;
  // Everytime the API is queried, the value will be updated by a random percentage.
  deltaPercent: number;
  name: string;
}

const assets: Asset[] = [
  {
    value: 1000,
    deltaPercent: 10,
    name: 'MOCK-ETH/USD',
  },
  {
    value: 5000,
    deltaPercent: 2,
    name: 'MOCK-BTC/USD',
  },
  {
    value: 750,
    deltaPercent: 80,
    name: 'MOCK-ABC/DEF',
  },
  {
    value: 50_000,
    deltaPercent: 20,
    name: 'MOCK-HJK/KOP',
  },
];

app.get('/', (_req, res) => {
  logger.debug('Request GET /');

  for (const asset of assets) {
    asset.value = Number.parseFloat(
      (asset.value * (1 + ((Math.random() - 0.5) * asset.deltaPercent) / 100)).toFixed(5)
    );
  }

  const response = Object.fromEntries(assets.map((asset) => [asset.name, asset.value]));
  logger.debug('Response GET /', response);

  res.json(response);
});

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
