import * as commonsModule from '@api3/commons';
import { ZodError } from 'zod';

import { config, nodarySignedTemplateResponses } from '../../test/fixtures';
import { logger } from '../logger';
import * as stateModule from '../state';

import { pushSignedData } from './signed-api';

describe(pushSignedData.name, () => {
  it('posts data to central api', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest
      .spyOn(commonsModule, 'executeRequest')
      .mockResolvedValue({ success: true, data: { count: 3, skipped: 1 }, errorData: undefined, statusCode: 200 });

    const response = await pushSignedData(nodarySignedTemplateResponses);

    expect(response).toStrictEqual([{ count: 3, success: true }]);
  });

  it('handles invalid response from signed API', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(logger, 'warn');
    jest.spyOn(commonsModule, 'executeRequest').mockResolvedValue({
      success: true,
      data: { strange: 'some-invalid-response' },
      errorData: undefined,
      statusCode: 500,
    });

    const response = await pushSignedData(nodarySignedTemplateResponses);

    expect(response).toStrictEqual([{ success: false }]);
    expect(logger.warn).toHaveBeenCalledWith('Failed to parse response from the signed API.', {
      errors: new ZodError([
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['count'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['skipped'],
          message: 'Required',
        },
        {
          code: 'unrecognized_keys',
          keys: ['strange'],
          path: [],
          message: "Unrecognized key(s) in object: 'strange'",
        },
      ]),
    });
  });

  it('handles request failure', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.spyOn(logger, 'warn');
    jest.spyOn(commonsModule, 'executeRequest').mockResolvedValue({
      success: false,
      errorData: { response: {} as any, code: '500', message: 'simulated-network-error' },
      data: undefined,
      statusCode: 500,
    });

    const response = await pushSignedData(nodarySignedTemplateResponses);

    expect(response).toStrictEqual([{ success: false }]);
    expect(logger.warn).toHaveBeenCalledWith('Failed to make update signed API request.', {
      response: {},
      code: '500',
      message: 'simulated-network-error',
    });
  });
});
