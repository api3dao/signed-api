import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createSha256Hash, serializePlainObject } from '@api3/commons';
import * as promiseUtilsModule from '@api3/promise-utils';
import { ethers } from 'ethers';

import { config, verifyHeartbeatLog } from '../../test/fixtures';
import * as stateModule from '../state';
import * as configModule from '../validation/config';

import { signHeartbeat } from './heartbeat-utils';
import { heartbeatLogger } from './logger';

import { initiateHeartbeatLoop, logHeartbeat } from '.';

// eslint-disable-next-line jest/no-hooks
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2023-01-20')); // 1674172800
});

afterEach(() => {
  jest.useRealTimers();
});

describe(logHeartbeat.name, () => {
  it('sends the correct heartbeat log', async () => {
    const rawConfig = JSON.parse(readFileSync(join(__dirname, '../../config/airnode-feed.example.json'), 'utf8'));
    rawConfig.nodeSettings.nodeVersion = '0.7.0';
    jest.spyOn(configModule, 'loadRawConfig').mockReturnValue(rawConfig);
    const state = stateModule.getInitialState({
      ...config,
      nodeSettings: { ...config.nodeSettings, nodeVersion: '0.7.0' },
    });
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(heartbeatLogger, 'info').mockImplementation();
    jest.advanceTimersByTime(1000 * 3); // Advance time by 3 seconds to ensure the timestamp of the log is different from deployment timestamp.

    await logHeartbeat();

    // NOTE: This tests will fail each time the example config changes (except for the nodeVersion). This should be
    // quite rare and the test verifies that the heartbeat sends correct data.
    const expectedHeartbeat = {
      configHash: '0xce9f58b6927572c9cc6e3bb532e6bd54899c8b3a2c15da18ee556599f1b3249f',
      airnode: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
      signature:
        '0x29e4b58fe8ebac9a7c26de469978707b5d291eac06b76b4e8cca501011360de879d2e3dc498fd84e19d4c4a57b809e0e32f6855c2a834a38167dac5f891f159c1c',
      stage: 'test',
      nodeVersion: '0.7.0',
      currentTimestamp: '1674172803',
      deploymentTimestamp: '1674172800',
    };
    expect(heartbeatLogger.info).toHaveBeenCalledWith('Sending heartbeat log.', expectedHeartbeat);
    expect(() => verifyHeartbeatLog(expectedHeartbeat, serializePlainObject(rawConfig))).not.toThrow();
  });
});

describe(verifyHeartbeatLog.name, () => {
  it('heartbeat payload can be parsed from JSON log', async () => {
    const rawConfig = JSON.parse(readFileSync(join(__dirname, '../../config/airnode-feed.example.json'), 'utf8'));
    const serializedConfig = serializePlainObject(rawConfig);
    const configHash = createSha256Hash(serializedConfig);
    const unsignedPayload = {
      airnode: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
      configHash,
      currentTimestamp: '1674172803',
      deploymentTimestamp: '1674172800',
      nodeVersion: '0.1.0',
      stage: 'test',
    };
    const signature = await signHeartbeat(
      ethers.Wallet.fromMnemonic('diamond result history offer forest diagram crop armed stumble orchard stage glance'),
      unsignedPayload
    );
    const jsonLog = {
      context: {
        ...unsignedPayload,
        signature,
      },
      level: 'info',
      message: 'Sending heartbeat log',
      ms: '+0ms',
      timestamp: '2023-01-20T00:00:03.000Z',
    };

    expect(() => verifyHeartbeatLog(jsonLog.context, serializedConfig)).not.toThrow();
  });
});

test('sends heartbeat payload every minute', async () => {
  // We would ideally want to assert that the logHeartbeat function is called, but spying on functions that are called
  // from the same module is annoying. See: https://jestjs.io/docs/mock-functions#mocking-partials.
  //
  // Instead we spyOn the "go" which is a third party module that wraps the logHeartbeat call.
  jest.spyOn(promiseUtilsModule, 'go');

  initiateHeartbeatLoop();

  await jest.advanceTimersByTimeAsync(1000 * 60 * 8);
  expect(promiseUtilsModule.go).toHaveBeenCalledTimes(8);
});
