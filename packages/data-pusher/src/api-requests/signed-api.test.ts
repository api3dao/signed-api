import axios from 'axios';
import { ZodError } from 'zod';
import { postSignedApiData, signTemplateResponses } from './signed-api';
import {
  config,
  createMockedLogger,
  signedApiResponse,
  nodarySignedTemplateResponses,
  nodaryTemplateResponses,
} from '../../test/fixtures';
import * as loggerModule from '../logger';
import * as stateModule from '../state';

describe(signTemplateResponses.name, () => {
  it('signs template responses', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.useFakeTimers().setSystemTime(new Date('2023-01-20'));

    const signedTemplateResponses = await signTemplateResponses(nodaryTemplateResponses);

    expect(signedTemplateResponses).toEqual(nodarySignedTemplateResponses);
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});

describe(postSignedApiData.name, () => {
  it('posts data to central api', async () => {
    const state = stateModule.getInitialState(config);
    // Assumes the template responses are for unique template IDs (which is true in the test fixtures).
    state.templateValues = Object.fromEntries(
      nodarySignedTemplateResponses.map(([templateId, signedData]) => {
        const dataQueue = new stateModule.DelayedSignedDataQueue();
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
        const dataQueue = new stateModule.DelayedSignedDataQueue();
        dataQueue.put(signedData);
        return [templateId, dataQueue];
      })
    );
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    const logger = createMockedLogger();
    jest.spyOn(loggerModule, 'logger').mockReturnValue(logger);
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
        const dataQueue = new stateModule.DelayedSignedDataQueue();
        dataQueue.put(signedData);
        return [templateId, dataQueue];
      })
    );
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    const logger = createMockedLogger();
    jest.spyOn(loggerModule, 'logger').mockReturnValue(logger);
    jest.spyOn(axios, 'post').mockRejectedValue('simulated-network-error');

    const response = await postSignedApiData(config.triggers.signedApiUpdates[0]!);

    expect(response).toEqual({ success: false });
    expect(logger.warn).toHaveBeenCalledWith('Failed to make update signed API request.', {
      axiosResponse: undefined,
      signedApiName: 'localhost',
      updateDelay: 5,
    });
  });
});
