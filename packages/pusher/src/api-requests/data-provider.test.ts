import * as adapterModule from '@api3/airnode-adapter';

import {
  config,
  nodaryTemplateRequestErrorResponse,
  nodaryTemplateRequestResponseData,
  nodaryTemplateResponses,
} from '../../test/fixtures';
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
    jest.spyOn(adapterModule, 'buildAndExecuteRequest').mockRejectedValue(nodaryTemplateRequestErrorResponse);

    await expect(makeTemplateRequests(config.triggers.signedApiUpdates[0]!)).rejects.toStrictEqual({
      errorMessage: 'Invalid API key',
      success: false,
    });
  });
});
