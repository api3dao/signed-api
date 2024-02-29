import { join } from 'node:path';
import { cwd } from 'node:process';

import {
  interpolateSecretsIntoConfig,
  loadConfig as loadRawConfigFromFilesystem,
  loadSecrets as loadRawSecretsFromFilesystem,
} from '@api3/commons';
import { go } from '@api3/promise-utils';

import { logger } from '../logger';

import { configSchema } from './schema';

// When Airnode feed is built, the "/dist" file contains "src" folder and "package.json" and the config is expected to
// be located next to the "/dist" folder. When run in development, the config is expected to be located next to the
// "src" folder (one less import level). We resolve the config by CWD as a workaround. Since the Airnode feed is
// dockerized, this is hidden from the user.
const getConfigPath = () => join(cwd(), './config');

export const loadRawConfig = () => loadRawConfigFromFilesystem(join(getConfigPath(), 'airnode-feed.json'));

export const loadConfig = async () => {
  const goLoadConfig = await go(async () => {
    const rawConfig = loadRawConfig();
    const rawSecrets = loadRawSecretsFromFilesystem(join(getConfigPath(), 'secrets.env'));
    return configSchema.parseAsync(interpolateSecretsIntoConfig(rawConfig, rawSecrets));
  });

  if (!goLoadConfig.success) {
    logger.error(`Unable to load configuration.`, goLoadConfig.error);
    return null;
  }
  return goLoadConfig.data;
};
