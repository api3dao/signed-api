import axios from 'axios';
import { ZodError } from 'zod';

import { config, signedApiResponse, nodarySignedTemplateResponses } from '../../test/fixtures';
import { logger } from '../logger';
import * as stateModule from '../state';

import { pushSignedData } from './signed-api';

describe(pushSignedData.name, () => {
  it('posts data to central api', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(axios, 'post').mockResolvedValue(signedApiResponse);

    const response = await pushSignedData(nodarySignedTemplateResponses);

    expect(response).toStrictEqual([{ count: 3, success: true }]);
  });

  it('handles invalid response from signed API', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(logger, 'warn');
    jest.spyOn(axios, 'post').mockResolvedValue({ youHaveNotThoughtAboutThisDidYou: 'yes-I-did' });

    const response = await pushSignedData(nodarySignedTemplateResponses);

    expect(response).toStrictEqual([{ success: false }]);
    expect(logger.warn).toHaveBeenCalledWith('Failed to parse response from the signed API.', {
      errors: new ZodError([
        {
          code: 'invalid_type',
          expected: 'object',
          received: 'undefined',
          path: [],
          message: 'Required',
        },
      ]),
    });
  });

  it('handles request failure', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(logger, 'warn');
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('simulated-network-error'));

    const response = await pushSignedData(nodarySignedTemplateResponses);

    expect(response).toStrictEqual([{ success: false }]);
    expect(logger.warn).toHaveBeenCalledWith('Failed to make update signed API request.', {
      errorMessage: 'simulated-network-error',
      axiosResponse: {},
    });
  });
});
