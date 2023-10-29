import fs, { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { go } from '@api3/promise-utils';
import dotenv from 'dotenv';

import { configSchema } from './schema';
import { interpolateSecrets, parseSecrets } from './utils';

// When pusher is built the "/dist" file contains "src" folder and "package.json" and the config is expected to be
// located next to the "/dist" folder. When run in development, the config is expected to be located next to the "src"
// folder (one less import level). We resolve the config by CWD as a workaround. Since the pusher is dockerized, this
// is hidden from the user.
const getConfigPath = () => join(cwd(), './config');

export const loadRawConfig = () => JSON.parse(fs.readFileSync(join(getConfigPath(), 'pusher.json'), 'utf8'));

export const loadConfig = async () => {
  const goLoadConfig = await go(async () => {
    const rawSecrets = dotenv.parse(readFileSync(join(getConfigPath(), 'secrets.env'), 'utf8'));
    const rawConfig = loadRawConfig();
    const secrets = parseSecrets(rawSecrets);
    return configSchema.parseAsync(interpolateSecrets(rawConfig, secrets));
  });

  if (!goLoadConfig.success) throw new Error(`Unable to load configuration.`, { cause: goLoadConfig.error });
  return goLoadConfig.data;
};
