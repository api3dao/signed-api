// TODO: This logic should be implemented from Airnode.

import fs from 'fs';
import { z } from 'zod';
import template from 'lodash/template';
import { goSync } from '@api3/promise-utils';
import { configSchema } from './validation';

type Secrets = Record<string, string | undefined>;

export const loadConfig = async (configPath: string, secrets: Record<string, string | undefined>) => {
  const rawConfig = readConfig(configPath);
  const parsedConfigRes = await parseConfigWithSecrets(rawConfig, secrets);
  if (!parsedConfigRes.success) {
    throw new Error(`Invalid configuration file: ${parsedConfigRes.error}`);
  }

  const config = parsedConfigRes.data;
  return config;
};

export const readConfig = (configPath: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse config file. ${err}`);
  }
};

export const parseConfigWithSecrets = (config: unknown, secrets: unknown) => {
  const parseSecretsRes = parseSecrets(secrets);
  if (!parseSecretsRes.success) return parseSecretsRes;

  return parseConfigAsync(interpolateSecrets(config, parseSecretsRes.data));
};

export const parseSecrets = (secrets: unknown) => {
  const secretsSchema = z.record(z.string());

  const result = secretsSchema.safeParse(secrets);
  return result;
};

export const parseConfigAsync = (config: unknown) => {
  return configSchema.safeParseAsync(config);
};

// Regular expression that does not match anything, ensuring no escaping or interpolation happens
// https://github.com/lodash/lodash/blob/4.17.15/lodash.js#L199
const NO_MATCH_REGEXP = /($^)/;
// Regular expression matching ES template literal delimiter (${}) with escaping
// https://github.com/lodash/lodash/blob/4.17.15/lodash.js#L175
const ES_MATCH_REGEXP = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

export const interpolateSecrets = (config: unknown, secrets: Secrets) => {
  const goInterpolated = goSync(() =>
    template(JSON.stringify(config), {
      escape: NO_MATCH_REGEXP,
      evaluate: NO_MATCH_REGEXP,
      interpolate: ES_MATCH_REGEXP,
    })(secrets)
  );

  if (!goInterpolated.success) {
    throw new Error(`Error interpolating secrets. Make sure the secrets format is correct. ${goInterpolated.error}`);
  }

  const goJson = goSync(() => JSON.parse(goInterpolated.data));
  if (!goJson.success) {
    throw new Error('Configuration file is not a valid JSON after secrets interpolation.');
  }

  return goJson.data;
};
