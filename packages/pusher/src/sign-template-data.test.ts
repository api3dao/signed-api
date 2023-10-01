import { signTemplateResponses } from './sign-template-data';
import * as stateModule from './state';
import { config, nodarySignedTemplateResponses, nodaryTemplateResponses } from '../test/fixtures';

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
