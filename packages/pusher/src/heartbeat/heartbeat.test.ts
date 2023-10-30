import * as promiseUtilsModule from '@api3/promise-utils';

import { config, parseHeartbeatLog } from '../../test/fixtures';
import * as stateModule from '../state';
import { loadRawConfig } from '../validation/config';

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
    '0x6d4306f70c5fe9d8608b4e0c1d72e06a366e6f60b8461a6a9a0833a7401f5778',
    '0x6e6379a42b89bdc78286efd6f6ad94142765930c4843784f49ba955ea95c1cb64c432b41aecc1b220dc90d616332bbf7bdc7242a16eb0e31306dac96a6d6ee821b',
  ].join(' - ');

  it('sends the correct heartbeat log', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(heartbeatLogger, 'info').mockImplementation();
    jest.advanceTimersByTime(1000 * 3); // Advance time by 3 seconds to ensure the timestamp of the log is different from deployment timestamp.

    await logHeartbeat();

    expect(heartbeatLogger.info).toHaveBeenCalledWith(expectedLogMessage);
  });

  it('the heartbeat log can be parsed', () => {
    const rawConfig = loadRawConfig();
    const expectedHeartbeatPayload = {
      airnodeAddress: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
      stage: 'test',
      nodeVersion: '0.1.0',
      heartbeatTimestamp: '1674172803',
      deploymentTimestamp: '1674172800',
      configHash: '0x6d4306f70c5fe9d8608b4e0c1d72e06a366e6f60b8461a6a9a0833a7401f5778',
      signature:
        '0x6e6379a42b89bdc78286efd6f6ad94142765930c4843784f49ba955ea95c1cb64c432b41aecc1b220dc90d616332bbf7bdc7242a16eb0e31306dac96a6d6ee821b',
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
