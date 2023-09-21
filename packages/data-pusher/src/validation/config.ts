import fs from 'fs';
import { go } from '@api3/promise-utils';
import { configSchema } from './schema';
import { interpolateSecrets, parseSecrets } from './utils';

export const loadConfig = async (configPath: string, rawSecrets: Record<string, string | undefined>) => {
  const goLoadConfig = await go(async () => {
    const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const secrets = parseSecrets(rawSecrets);
    return configSchema.parseAsync(interpolateSecrets(rawConfig, secrets));
  });

  if (!goLoadConfig.success) throw new Error(`Unable to load configuration.`, { cause: goLoadConfig.error });
  return goLoadConfig.data;
};
