import { config, nodarySignedTemplateResponses, nodaryTemplateResponses } from '../test/fixtures';

import { signTemplateResponses } from './sign-template-data';
import * as stateModule from './state';

describe(signTemplateResponses.name, () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('signs template responses', async () => {
    const state = stateModule.getInitialState(config);
    jest.spyOn(stateModule, 'getState').mockReturnValue(state);
    jest.useFakeTimers().setSystemTime(new Date('2023-01-20')); // 1674172800

    const signedTemplateResponses = await signTemplateResponses(nodaryTemplateResponses);

    expect(signedTemplateResponses).toStrictEqual(nodarySignedTemplateResponses);
  });
});
