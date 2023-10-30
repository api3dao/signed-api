import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const getMockedConfig = () => {
  const config = JSON.parse(readFileSync(join(__dirname, '../config/signed-api.example.json'), 'utf8'));
  config.allowedAirnodes = 'all';

  return config;
};
