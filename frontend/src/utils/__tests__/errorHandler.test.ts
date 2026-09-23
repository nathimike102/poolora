import { AxiosError, AxiosHeaders } from 'axios';
import { ApiError, errorHandler } from '../errorHandler';

function axios401(message: string): AxiosError {
  const config = { headers: new AxiosHeaders(), url: '/auth/verify-otp' };
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, {}, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data: { status: 'error', error: { message } },
  });
}

describe('errorHandler', () => {
  test("uses the backend's message for HTTP errors", () => {
    const processed = errorHandler.process(axios401('Invalid OTP. 4 attempts remaining.'));
    expect(processed.message).toBe('Invalid OTP. 4 attempts remaining.');
    expect(processed.code).toBe(401);
  });

  test('ApiError is a real Error that keeps the message and status', () => {
    const error = new ApiError(errorHandler.process(axios401('Invalid OTP.')));
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Invalid OTP.');
    expect(error.code).toBe(401);
  });

  test('processing an ApiError again keeps its message', () => {
    const error = new ApiError(errorHandler.process(axios401('Invalid OTP.')));
    expect(errorHandler.process(error).message).toBe('Invalid OTP.');
  });
});
