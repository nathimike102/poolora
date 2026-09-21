import { AxiosError } from 'axios';
import { apiClient } from '../axios';
import { setupAllInterceptors } from '../interceptors';
import { API_CONFIG } from '../constants';
import { ApiError } from '../../utils/errorHandler';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn(),
}));

let calls = 0;
function respondWith(status: number, message = 'nope') {
  calls = 0;
  apiClient.defaults.adapter = async config => {
    calls += 1;
    throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, {
      status,
      statusText: '',
      headers: {},
      config,
      data: { status: 'error', error: { message } },
    });
  };
}

describe('API interceptors', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    setupAllInterceptors();
  });
  afterAll(() => jest.useRealTimers());

  async function settle<T>(promise: Promise<T>): Promise<unknown> {
    const result = promise.then(() => 'resolved', e => e);
    for (let i = 0; i < 10; i++) await jest.advanceTimersByTimeAsync(30_000);
    return result;
  }

  test('a failing GET is retried a bounded number of times', async () => {
    respondWith(503, 'Maps service is not configured');
    const error = await settle(apiClient.get('/maps/geocode'));
    expect(calls).toBe(1 + API_CONFIG.retryAttempts);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Maps service is not configured');
  });

  test('429 is not retried', async () => {
    respondWith(429, 'Rate limit exceeded');
    await settle(apiClient.get('/maps/geocode'));
    expect(calls).toBe(1);
  });

  test('noRetry requests are sent once', async () => {
    respondWith(503);
    await settle(apiClient.get('/maps/autocomplete', { noRetry: true }));
    expect(calls).toBe(1);
  });

  test('a wrong OTP is reported, not treated as an expired session', async () => {
    respondWith(401, 'Invalid OTP. 4 attempts remaining.');
    const error = await settle(apiClient.post('/auth/verify-otp', {}));
    expect(calls).toBe(1);
    expect((error as Error).message).toBe('Invalid OTP. 4 attempts remaining.');
  });
});
