import { readFileSync } from 'fs';
import { join } from 'path';
import { go } from '@api3/promise-utils';
import { S3 } from '@aws-sdk/client-s3';
import { logger } from './logger';
import { Config, configSchema } from './schema';
import { loadEnv } from './env';

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

const fetchConfig = async (): Promise<any> => {
  const env = loadEnv();
  const source = env.CONFIG_SOURCE;
  if (!source || source === 'local') {
    return JSON.parse(readFileSync(join(__dirname, '../config/signed-api.json'), 'utf8'));
  }
  if (source === 'aws-s3') {
    return await fetchConfigFromS3();
  }
  throw new Error(`Unable to load config CONFIG_SOURCE:${source}`);
};

const fetchConfigFromS3 = async (): Promise<any> => {
  const env = loadEnv();
  const region = env.AWS_REGION!; // Validated by environment variables schema.
  const s3 = new S3({ region });

  const params = {
    Bucket: env.AWS_S3_BUCKET_NAME,
    Key: env.AWS_S3_BUCKET_PATH,
  };

  logger.info(`Fetching config from AWS S3 region:${region}...`);
  const res = await go(() => s3.getObject(params), { retries: 1 });
  if (!res.success) {
    logger.error('Error fetching config from AWS S3:', res.error);
    throw res.error;
  }
  logger.info('Config fetched successfully from AWS S3');
  const stringifiedConfig = await res.data.Body!.transformToString();
  return JSON.parse(stringifiedConfig);
};