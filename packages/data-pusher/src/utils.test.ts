import { calculateTimeout, prepareGoOptions } from './utils';

describe('calculateTimeout', () => {
  it('calculates the remaining time for timeout', () => {
    const startTime = 1650548022000;
    const totalTimeout = 3000;
    jest.spyOn(Date, 'now').mockReturnValue(1650548023000);

    expect(calculateTimeout(startTime, totalTimeout)).toEqual(2000);
  });
});

describe('prepareGoOptions', () => {
  it('prepares options for the go function', () => {
    const startTime = 1650548022000;
    const totalTimeout = 3000;
    jest.spyOn(Date, 'now').mockReturnValue(1650548023000);

    const expectedGoOptions = {
      delay: { type: 'random' as const, minDelayMs: 0, maxDelayMs: 2_500 },
    };
    expect(prepareGoOptions(startTime, totalTimeout)).toEqual(expectedGoOptions);
  });
});
