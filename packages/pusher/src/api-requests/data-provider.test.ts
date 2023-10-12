import * as adapterModule from '@api3/airnode-adapter';

import {
  config,
  nodaryTemplateRequestError,
  nodaryTemplateRequestResponseData,
  nodaryTemplateResponses,
} from '../../test/fixtures';
import { logger } from '../logger';
import * as stateModule from '../state';

import { makeTemplateRequests } from './data-provider';

describe(makeTemplateRequests.name, () => {
  it('makes a single template request for multiple beacons', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(adapterModule, 'buildAndExecuteRequest').mockResolvedValue(nodaryTemplateRequestResponseData);

    const response = await makeTemplateRequests(config.triggers.signedApiUpdates[0]!);

    expect(response).toStrictEqual(nodaryTemplateResponses);
  });

  it('handles request failure', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(logger, 'warn');
    jest.spyOn(adapterModule, 'buildAndExecuteRequest').mockRejectedValue(nodaryTemplateRequestError);

    await makeTemplateRequests(config.triggers.signedApiUpdates[0]!);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('Failed to make API call', {
      endpointName: 'feed',
      errorMessage: 'Invalid API key',
      oisTitle: 'Nodary',
      operationTemplateId: '0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd',
    });
  });
});
