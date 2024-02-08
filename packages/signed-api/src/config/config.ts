import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { go, goSync } from '@api3/promise-utils';
import { S3 } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

import { loadEnv } from '../env';
import { logger } from '../logger';
import { type Config, configSchema } from '../schema';

import { interpolateSecrets, parseSecrets } from './secrets';

let config: Config | undefined;

export const getConfig = (): Config => {
  if (!config) throw new Error(`Config has not been set yet`);

  return config;
};

// When Signed API is built, the "/dist" file contains "src" folder and "package.json" and the config is expected to be
// located next to the "/dist" folder. When run in development, the config is expected to be located next to the "src"
// folder (one less import level). We resolve the config by CWD as a workaround. Since the Signed API is dockerized,
// this is hidden from the user.
const getConfigPath = () => join(cwd(), './config');

export const loadRawConfigFromFilesystem = () =>
  JSON.parse(readFileSync(join(getConfigPath(), 'signed-api.json'), 'utf8'));

export const loadRawSecretsFromFilesystem = () =>
  dotenv.parse(readFileSync(join(getConfigPath(), 'secrets.env'), 'utf8'));

export const loadConfigFromFilesystem = () => {
  const goLoadConfig = goSync(() => {
    const rawSecrets = loadRawSecretsFromFilesystem();
    const rawConfig = loadRawConfigFromFilesystem();
    const secrets = parseSecrets(rawSecrets);
    return interpolateSecrets(rawConfig, secrets);
  });

  if (!goLoadConfig.success) {
    logger.error(`Unable to load configuration.`, goLoadConfig.error);
    return null;
  }
  return goLoadConfig.data;
};

export const loadNonValidatedConfig = async () => {
  const env = loadEnv();
  const source = env.CONFIG_SOURCE;
  switch (source) {
    case 'local': {
      return loadConfigFromFilesystem();
    }
    case 'aws-s3': {
      return loadConfigFromS3();
    }
  }
};

export const loadConfig = async () => {
  if (config) return config;

  const nonValidatedConfig = await loadNonValidatedConfig();
  if (!nonValidatedConfig) return null;

  const safeParsedConfig = configSchema.safeParse(nonValidatedConfig);
  if (!safeParsedConfig.success) {
    logger.error('Config failed validation.', safeParsedConfig.error);
    return null;
  }
  return (config = safeParsedConfig.data);
};

const loadConfigFromS3 = async (): Promise<any> => {
  const goFetchConfig = await go(async () => {
    const env = loadEnv();
    const region = env.AWS_REGION!; // Validated by environment variables schema.
    const s3 = new S3({ region });

    const params = {
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: env.AWS_S3_BUCKET_PATH,
    };

    logger.info(`Fetching config from AWS S3 region.`, { region });
    const res = await go(async () => s3.getObject(params), { retries: 1 });
    if (!res.success) {
      logger.error('Error fetching config from AWS S3.', res.error);
      return null;
    }
    logger.info('Config fetched successfully from AWS S3.');
    const stringifiedConfig = await res.data.Body!.transformToString();
    return JSON.parse(stringifiedConfig);
  });

  // Check whether the config returned a truthy response, because false response assumes an error has been handled.
  if (!goFetchConfig.success || !goFetchConfig.data) {
    logger.error('Unexpected error during fetching config from S3.', goFetchConfig.error);
    return null;
  }
  return goFetchConfig.data;
};
