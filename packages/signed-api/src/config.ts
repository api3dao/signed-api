import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { go } from '@api3/promise-utils';
import { S3 } from '@aws-sdk/client-s3';

import { loadEnv } from './env';
import { logger } from './logger';
import { type Config, configSchema } from './schema';

let config: Config | undefined;

export const getConfig = (): Config => {
  if (!config) throw new Error(`Config has not been set yet`);

  return config;
};

export const fetchAndCacheConfig = async (): Promise<Config> => {
  const jsonConfig = await fetchConfig();
  config = configSchema.parse(jsonConfig);
  return config;
};

// When Signed API is built, the "/dist" file contains "src" folder and "package.json" and the config is expected to be
// located next to the "/dist" folder. When run in development, the config is expected to be located next to the "src"
// folder (one less import level). We resolve the config by CWD as a workaround. Since the Signed API is dockerized,
// this is hidden from the user.
const getConfigPath = () => join(cwd(), './config');

export const loadConfigFromFilesystem = () =>
  JSON.parse(readFileSync(join(getConfigPath(), 'signed-api.json'), 'utf8'));

const fetchConfig = async (): Promise<any> => {
  const env = loadEnv();
  const source = env.CONFIG_SOURCE;
  switch (source) {
    case 'local': {
      return loadConfigFromFilesystem();
    }
    case 'aws-s3': {
      return fetchConfigFromS3();
    }
  }
};

const fetchConfigFromS3 = async (): Promise<any> => {
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
    throw res.error;
  }
  logger.info('Config fetched successfully from AWS S3.');
  const stringifiedConfig = await res.data.Body!.transformToString();
  return JSON.parse(stringifiedConfig);
};
