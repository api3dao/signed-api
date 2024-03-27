import * as adapterModule from '@api3/airnode-adapter';
import axios from 'axios';

import {
  config,
  nodaryTemplateRequestError,
  nodaryTemplateRequestResponseData,
  nodaryTemplateResponses,
} from '../../test/fixtures';
import { logger } from '../logger';
import * as stateModule from '../state';
import type { Config } from '../validation/schema';

import { makeTemplateRequests } from './data-provider';

jest.mock('axios');

describe(makeTemplateRequests.name, () => {
  it('makes a single template request for multiple beacons', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(adapterModule, 'buildAndExecuteRequest').mockResolvedValue(nodaryTemplateRequestResponseData);

    jest.useFakeTimers().setSystemTime(new Date('2023-01-20')); // 1674172800

    const response = await makeTemplateRequests(config.triggers.signedApiUpdates[0]);

    expect(response).toStrictEqual(nodaryTemplateResponses);
    expect(adapterModule.buildAndExecuteRequest).toHaveBeenCalledTimes(1);
  });

  it('handles request failure', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(logger, 'warn');
    jest.spyOn(adapterModule, 'buildAndExecuteRequest').mockRejectedValue(nodaryTemplateRequestError);

    await makeTemplateRequests(config.triggers.signedApiUpdates[0]);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('Failed to make API call.', {
      endpointName: 'feed',
      errorMessage: 'Invalid API key',
      oisTitle: 'Nodary',
      operationTemplateId: '0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd',
    });
  });

  it('can uses fixed operational parameters', async () => {
    const configWithFixedOperationalParameters: Config = {
      ...config,
      ois: [
        {
          ...config.ois[0]!,
          endpoints: [
            {
              ...config.ois[0]!.endpoints[0]!,
              fixedOperationParameters: [
                {
                  operationParameter: {
                    in: 'query',
                    name: 'some-api-parameter',
                  },
                  value: 'some-value',
                },
              ],
            },
          ],
          apiSpecifications: {
            ...config.ois[0]!.apiSpecifications,
            paths: {
              '/feed/latestV2': {
                get: {
                  parameters: [
                    { in: 'query', name: 'names' },
                    { in: 'query', name: 'some-api-parameter' },
                  ],
                },
              },
            },
            servers: [{ url: 'https://api.nodary.io' }],
            security: { NodarySecurityScheme1ApiKey: [] },
          },
        },
      ],
    };
    const state = stateModule.getInitialState(configWithFixedOperationalParameters);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    (axios as jest.MockedFunction<typeof axios>).mockRejectedValue(new Error('network error'));

    await makeTemplateRequests(config.triggers.signedApiUpdates[0]);

    expect(axios).toHaveBeenCalledTimes(1);
    expect(axios).toHaveBeenCalledWith({
      data: undefined,
      headers: {
        'x-nodary-api-key': 'invalid-api-key',
      },
      method: 'get',
      params: {
        'some-api-parameter': 'some-value',
      },
      timeout: 10_000,
      url: 'https://api.nodary.io/feed/latestV2',
    });
  });

  it('can skip an API call', async () => {
    const configWithoutAPI: Config = {
      ...config,
      apiCredentials: [],
      ois: [
        {
          ...config.ois[0]!,
          apiSpecifications: {
            ...config.ois[0]!.apiSpecifications,
            paths: {},
            servers: [],
            security: {},
          },
          endpoints: [
            {
              ...config.ois[0]!.endpoints[0]!,
              operation: undefined,
              fixedOperationParameters: [],
              postProcessingSpecifications: [
                {
                  environment: 'Node',
                  value: 'const output = 123;',
                  timeoutMs: 5000,
                },
              ],
            },
          ],
        },
      ],
    };
    const state = stateModule.getInitialState(configWithoutAPI);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);

    const buildAndExecuteRequestSpy = jest.spyOn(adapterModule, 'buildAndExecuteRequest');

    const makeTemplateRequestsResult = await makeTemplateRequests(config.triggers.signedApiUpdates[0]);

    expect(axios).toHaveBeenCalledTimes(0);
    expect(buildAndExecuteRequestSpy).not.toHaveBeenCalled();
    expect(makeTemplateRequestsResult![0]![1].encodedResponse.rawValue).toBe(123);
  });

  it('can skip an API call using post processing v2', async () => {
    const configWithoutAPI: Config = {
      ...config,
      apiCredentials: [],
      ois: [
        {
          ...config.ois[0]!,
          apiSpecifications: {
            ...config.ois[0]!.apiSpecifications,
            paths: {},
            servers: [],
            security: {},
          },
          endpoints: [
            {
              ...config.ois[0]!.endpoints[0]!,
              operation: undefined,
              fixedOperationParameters: [],
              postProcessingSpecificationV2: {
                environment: 'Node',
                value: '({ response }) => { return { response: Math.round(Math.random() * 1000) } }',
                timeoutMs: 5000,
              },
            },
          ],
        },
      ],
    };
    const state = stateModule.getInitialState(configWithoutAPI);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);

    const buildAndExecuteRequestSpy = jest.spyOn(adapterModule, 'buildAndExecuteRequest');

    const makeTemplateRequestsResult = await makeTemplateRequests(config.triggers.signedApiUpdates[0]);

    expect(axios).toHaveBeenCalledTimes(0);
    expect(buildAndExecuteRequestSpy).not.toHaveBeenCalled();
    expect(makeTemplateRequestsResult![0]![1].encodedResponse.rawValue).toBeGreaterThanOrEqual(0);
    expect(makeTemplateRequestsResult![0]![1].encodedResponse.rawValue).toBeLessThanOrEqual(1000);
  });
});
