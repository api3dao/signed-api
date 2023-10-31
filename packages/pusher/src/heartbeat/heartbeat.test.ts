import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as promiseUtilsModule from '@api3/promise-utils';

import { config, parseHeartbeatLog } from '../../test/fixtures';
import * as stateModule from '../state';
import * as configModule from '../validation/config';

import { heartbeatLogger } from './logger';

import { initiateHeartbeat, logHeartbeat, createHash } from '.';

// eslint-disable-next-line jest/no-hooks
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2023-01-20'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe(logHeartbeat.name, () => {
  const expectedLogMessage = [
    '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
    'test',
    '0.1.0',
    '1674172803',
    '1674172800',
    '0x126e768ba244efdb790d63a76821047e163dfc502ace09b2546a93075594c286',
    '0x14f123ec1006bace8f8971cd8c94eb022b9bb0e1364e88ae4e8562a5f02de43e35dd4ecdefc976595eba5fec3d04222a0249e876453599b27847e85e14ff77601b',
  ].join(' - ');

  it('sends the correct heartbeat log', async () => {
    const rawConfig = JSON.parse(readFileSync(join(__dirname, '../../config/pusher.example.json'), 'utf8'));
    jest.spyOn(configModule, 'loadRawConfig').mockReturnValue(rawConfig);
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(heartbeatLogger, 'info').mockImplementation();
    jest.advanceTimersByTime(1000 * 3); // Advance time by 3 seconds to ensure the timestamp of the log is different from deployment timestamp.

    await logHeartbeat();

    expect(heartbeatLogger.info).toHaveBeenCalledWith(expectedLogMessage);
  });

  it('the heartbeat log can be parsed', () => {
    const rawConfig = JSON.parse(readFileSync(join(__dirname, '../../config/pusher.example.json'), 'utf8'));
    jest.spyOn(configModule, 'loadRawConfig').mockReturnValue(rawConfig);
    const expectedHeartbeatPayload = {
      airnodeAddress: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
      stage: 'test',
      nodeVersion: '0.1.0',
      heartbeatTimestamp: '1674172803',
      deploymentTimestamp: '1674172800',
      configHash: '0x126e768ba244efdb790d63a76821047e163dfc502ace09b2546a93075594c286',
      signature:
        '0x14f123ec1006bace8f8971cd8c94eb022b9bb0e1364e88ae4e8562a5f02de43e35dd4ecdefc976595eba5fec3d04222a0249e876453599b27847e85e14ff77601b',
    };

    const heartbeatPayload = parseHeartbeatLog(expectedLogMessage);

    expect(heartbeatPayload).toStrictEqual(expectedHeartbeatPayload);
    expect(heartbeatPayload.configHash).toBe(createHash(JSON.stringify(rawConfig)));
  });
});

test('sends heartbeat payload every minute', async () => {
  // We would ideally want to assert that the logHeartbeat function is called, but spying on functions that are called
  // from the same module is annoying. See: https://jestjs.io/docs/mock-functions#mocking-partials.
  //
  // Instead we spyOn the "go" which is a third party module that wraps the logHeartbeat call.
  jest.spyOn(promiseUtilsModule, 'go');

  initiateHeartbeat();

  await jest.advanceTimersByTimeAsync(1000 * 60 * 8);
  expect(promiseUtilsModule.go).toHaveBeenCalledTimes(8);
});
