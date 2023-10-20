import fs, { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { go } from '@api3/promise-utils';
import dotenv from 'dotenv';

import { configSchema } from './schema';
import { interpolateSecrets, parseSecrets } from './utils';

export const loadConfig = async () => {
  // When pusher is built the "/dist" file contains "src" folder and "package.json" and the config is expected to be
  // located next to the "/dist" folder. When run in development, the config is expected to be located next to the "src"
  // folder (one less import level). We resolve the config by CWD as a workaround. Since the pusher is dockerized, this
  // is hidden from the user.
  const configPath = join(cwd(), './config');
  const rawSecrets = dotenv.parse(readFileSync(join(configPath, 'secrets.env'), 'utf8'));

  const goLoadConfig = await go(async () => {
    const rawConfig = JSON.parse(fs.readFileSync(join(configPath, 'pusher.json'), 'utf8'));
    const secrets = parseSecrets(rawSecrets);
    return configSchema.parseAsync(interpolateSecrets(rawConfig, secrets));
  });

  if (!goLoadConfig.success) throw new Error(`Unable to load configuration.`, { cause: goLoadConfig.error });
  return goLoadConfig.data;
};
