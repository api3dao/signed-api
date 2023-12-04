import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as promiseUtilsModule from '@api3/promise-utils';

import { config, verifyHeartbeatLog } from '../../test/fixtures';
import * as stateModule from '../state';
import * as configModule from '../validation/config';

import { heartbeatLogger } from './logger';

import { initiateHeartbeat, logHeartbeat, type HeartbeatPayload, stringifyUnsignedHeartbeatPayload } from '.';

// eslint-disable-next-line jest/no-hooks
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2023-01-20'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe(logHeartbeat.name, () => {
  it('sends the correct heartbeat log', async () => {
    const expectedLogMessage: HeartbeatPayload = {
      airnode: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
      stage: 'test',
      nodeVersion: '0.1.0',
      currentTimestamp: '1674172803',
      deploymentTimestamp: '1674172800',
      configHash: '0x1a2a00f22eeab37eb95f8cf1ec10ec89521516db42f41b7ffc6da541d948a54a',
      signature:
        '0xd0f84a62705585e03c14ebfda2688a4e4c733aa42a3d13f98d4fe390d482fd1c3e698e91939df28b9565a9de82f3495b053824ffe61239fdd4fa0e4a970523a81b',
    };
    const rawConfig = JSON.parse(readFileSync(join(__dirname, '../../config/airnode-feed.example.json'), 'utf8'));
    jest.spyOn(configModule, 'loadRawConfig').mockReturnValue(rawConfig);
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(heartbeatLogger, 'info').mockImplementation();
    jest.advanceTimersByTime(1000 * 3); // Advance time by 3 seconds to ensure the timestamp of the log is different from deployment timestamp.

    await logHeartbeat();

    expect(heartbeatLogger.info).toHaveBeenCalledWith('Sending heartbeat log.', expectedLogMessage);
  });
});

describe(verifyHeartbeatLog.name, () => {
  it('heartbeat payload can be parsed from JSON log', () => {
    const jsonLog = {
      context: {
        airnode: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
        configHash: '0x1a2a00f22eeab37eb95f8cf1ec10ec89521516db42f41b7ffc6da541d948a54a',
        currentTimestamp: '1674172803',
        deploymentTimestamp: '1674172800',
        nodeVersion: '0.1.0',
        signature:
          '0xd0f84a62705585e03c14ebfda2688a4e4c733aa42a3d13f98d4fe390d482fd1c3e698e91939df28b9565a9de82f3495b053824ffe61239fdd4fa0e4a970523a81b',
        stage: 'test',
      },
      level: 'info',
      message: 'Sending heartbeat log',
      ms: '+0ms',
      timestamp: '2023-01-20T00:00:03.000Z',
    };
    // The config hash is taken from config with all spaces removed.
    const rawConfig = JSON.stringify(
      JSON.parse(readFileSync(join(__dirname, '../../config/airnode-feed.example.json'), 'utf8'))
    );

    expect(() => verifyHeartbeatLog(jsonLog.context, rawConfig)).not.toThrow();
  });
});

describe(stringifyUnsignedHeartbeatPayload.name, () => {
  it('sorts the keys alphabetically', () => {
    expect(
      stringifyUnsignedHeartbeatPayload({
        airnode: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
        stage: 'test',
        nodeVersion: '0.1.0',
        currentTimestamp: '1674172803',
        deploymentTimestamp: '1674172800',
        configHash: '0x1a2a00f22eeab37eb95f8cf1ec10ec89521516db42f41b7ffc6da541d948a54a',
      })
    ).toBe(
      '{"airnode":"0xbF3137b0a7574563a23a8fC8badC6537F98197CC","configHash":"0x1a2a00f22eeab37eb95f8cf1ec10ec89521516db42f41b7ffc6da541d948a54a","currentTimestamp":"1674172803","deploymentTimestamp":"1674172800","nodeVersion":"0.1.0","stage":"test"}'
    );
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
