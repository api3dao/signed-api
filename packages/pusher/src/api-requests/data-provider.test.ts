import { api as nodeApiModule } from '@api3/airnode-node';
import { makeTemplateRequests } from './data-provider';
import * as stateModule from '../state';
import {
  config,
  nodaryTemplateRequestErrorResponse,
  nodaryTemplateRequestResponseData,
  nodaryTemplateResponses,
} from '../../test/fixtures';

describe(makeTemplateRequests.name, () => {
  it('makes a single template request for multiple beacons', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(nodeApiModule, 'performApiCall').mockResolvedValue([[], nodaryTemplateRequestResponseData]);

    const response = await makeTemplateRequests(config.triggers.signedApiUpdates[0]!);

    expect(response).toEqual(nodaryTemplateResponses);
  });

  it('handles request failure', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(nodeApiModule, 'performApiCall').mockRejectedValue(nodaryTemplateRequestErrorResponse);

    await expect(makeTemplateRequests(config.triggers.signedApiUpdates[0]!)).rejects.toEqual({
      errorMessage: 'Invalid API key',
      success: false,
    });
  });
});
