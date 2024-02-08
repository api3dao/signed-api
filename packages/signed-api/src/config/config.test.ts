import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import dotenv from 'dotenv';

import type { AllowedAirnode } from '../schema';

import * as configModule from './config';

test('interpolates example config and secrets', async () => {
  jest
    .spyOn(configModule, 'loadRawConfigFromFilesystem')
    .mockReturnValue(JSON.parse(readFileSync(join(__dirname, '../../config/signed-api.example.json'), 'utf8')));
  jest
    .spyOn(configModule, 'loadRawSecretsFromFilesystem')
    .mockReturnValue(dotenv.parse(readFileSync(join(__dirname, '../../config/secrets.example.env'), 'utf8')));

  const config = await configModule.loadConfig();

  expect(config!.endpoints[0]!.authTokens).toStrictEqual(['secret-endpoint-token']);
  expect((config!.allowedAirnodes[0] as AllowedAirnode).authTokens).toStrictEqual(['secret-airnode-token']);
});
