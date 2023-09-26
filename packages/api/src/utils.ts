import { readFileSync } from 'fs';
import { join } from 'path';
import { go } from '@api3/promise-utils';
import { S3 } from '@aws-sdk/client-s3';
import { COMMON_HEADERS } from './constants';
import { logger } from './logger';
import { BatchSignedData, Config, SignedData, configSchema } from './schema';
import { ApiResponse } from './types';

export const isBatchUnique = (batchSignedData: BatchSignedData) => {
  return (
    batchSignedData.length ===
    new Set(batchSignedData.map(({ airnode, templateId }) => airnode.concat(templateId))).size
  );
};

export const isIgnored = (signedData: SignedData, ignoreAfterTimestamp: number) => {
  return parseInt(signedData.timestamp) > ignoreAfterTimestamp;
};

export const generateErrorResponse = (
  statusCode: number,
  message: string,
  detail?: string,
  extra?: unknown
): ApiResponse => {
  return { statusCode, headers: COMMON_HEADERS, body: JSON.stringify({ message, detail, extra }) };
};

export const getAndParseConfig = async (): Promise<Config> => {
  const config = await getConfig();
  return configSchema.parse(config);
};

export const getConfig = async (): Promise<any> => {
  const source = process.env.CONFIG_SOURCE;
  if (!source || source === 'local') {
    return JSON.parse(readFileSync(join(__dirname, '../config/signed-api.json'), 'utf8'));
  }
  if (source === 'aws-s3') {
    return await fetchConfigFromS3();
  }
  throw new Error(`Unable to load config CONFIG_SOURCE:${source}`);
};

const fetchConfigFromS3 = async () => {
  const region = process.env.AWS_REGION!;
  const s3 = new S3({ region });

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: process.env.AWS_S3_BUCKET_PATH!,
  };

  logger.info(`Fetching config from S3 region:${region}...`);
  const res = await go(() => s3.getObject(params), { retries: 1 });
  if (!res.success) {
    logger.error('Error fetching config from AWS S3:', res.error);
    throw res.error;
  }
  logger.info('Config fetched successfully from AWS S3');
  const stringifiedConfig = await res.data.Body!.transformToString();
  return JSON.parse(stringifiedConfig);
};
