jest.mock('../../config/redis', () => ({ getRedisClient: () => null }));

import { describeWait } from '../../middlewares/rateLimit.middleware';

describe('describeWait', () => {
  it.each([
    [0, '1 second'],
    [42, '42 seconds'],
    [60, '1 minute'],
    [2601, '44 minutes'],
    [3600, '1 hour'],
    [7201, '3 hours'],
  ])('%i seconds reads as "%s"', (seconds, text) => {
    expect(describeWait(seconds)).toBe(text);
  });
});
