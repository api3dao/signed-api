import axios from 'axios';
import { ZodError } from 'zod';
import { postSignedApiData } from './signed-api';
import { config, signedApiResponse, nodarySignedTemplateResponses } from '../../test/fixtures';
import { logger } from '../logger';
import * as stateModule from '../state';

describe(postSignedApiData.name, () => {
  it('posts data to central api', async () => {
    const state = stateModule.getInitialState(config);
    // Assumes the template responses are for unique template IDs (which is true in the test fixtures).
    state.templateValues = Object.fromEntries(
      nodarySignedTemplateResponses.map(([templateId, signedData]) => {
        const dataQueue = new stateModule.DelayedSignedDataQueue(0);
        dataQueue.put(signedData);
        return [templateId, dataQueue];
      })
    );
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(axios, 'post').mockResolvedValue(signedApiResponse);

    const response = await postSignedApiData(config.triggers.signedApiUpdates[0]!);

    expect(response).toEqual({ count: 3, success: true });
  });

  it('handles invalid response from signed API', async () => {
    const state = stateModule.getInitialState(config);
    // Assumes the template responses are for unique template IDs (which is true in the test fixtures).
    state.templateValues = Object.fromEntries(
      nodarySignedTemplateResponses.map(([templateId, signedData]) => {
        const dataQueue = new stateModule.DelayedSignedDataQueue(0);
        dataQueue.put(signedData);
        return [templateId, dataQueue];
      })
    );
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(logger, 'warn');
    jest.spyOn(axios, 'post').mockResolvedValue({ youHaveNotThoughAboutThisDidYou: 'yes-I-did' });

    const response = await postSignedApiData(config.triggers.signedApiUpdates[0]!);

    expect(response).toEqual({ success: false });
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
      signedApiName: 'localhost',
      updateDelay: 5,
    });
  });

  it('handles request failure', async () => {
    const state = stateModule.getInitialState(config);
    // Assumes the template responses are for unique template IDs (which is true in the test fixtures).
    state.templateValues = Object.fromEntries(
      nodarySignedTemplateResponses.map(([templateId, signedData]) => {
        const dataQueue = new stateModule.DelayedSignedDataQueue(0);
        dataQueue.put(signedData);
        return [templateId, dataQueue];
      })
    );
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(logger, 'warn');
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('simulated-network-error'));

    const response = await postSignedApiData(config.triggers.signedApiUpdates[0]!);

    expect(response).toEqual({ success: false });
    expect(logger.warn).toHaveBeenCalledWith('Failed to make update signed API request.', {
      errorMessage: 'simulated-network-error',
      axiosResponse: {},
      signedApiName: 'localhost',
      updateDelay: 5,
    });
  });
});
