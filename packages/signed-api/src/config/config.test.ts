import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as commonsModule from '@api3/commons';
import dotenv from 'dotenv';

import type { AllowedAirnode } from '../schema';

import * as configModule from './config';

test('interpolates example config and secrets', async () => {
  jest
    .spyOn(commonsModule, 'loadConfig')
    .mockReturnValue(JSON.parse(readFileSync(join(__dirname, '../../config/signed-api.example.json'), 'utf8')));
  jest
    .spyOn(commonsModule, 'loadSecrets')
    .mockReturnValue(dotenv.parse(readFileSync(join(__dirname, '../../config/secrets.example.env'), 'utf8')));

  const config = await configModule.loadConfig();

  expect(config!.endpoints[0]!.authTokens).toStrictEqual(['secret-endpoint-token']);
  expect((config!.allowedAirnodes[0] as AllowedAirnode).authTokens).toStrictEqual([
    'some-secret-token-for-airnode-feed',
  ]);
});
