import { callRazorpay } from '../../utils/razorpay';
import { AppError } from '../../utils/AppError';

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe('callRazorpay', () => {
  it('returns the provider result when the call succeeds', async () => {
    await expect(callRazorpay('create order', async () => ({ id: 'order_1' }))).resolves.toEqual({ id: 'order_1' });
  });

  it('turns a Razorpay SDK rejection into a 502 without the provider detail', async () => {
    const sdkError = { statusCode: 401, error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } };
    const result = callRazorpay('create order', () => Promise.reject(sdkError));

    await expect(result).rejects.toMatchObject({ statusCode: 502, errorId: 'PAYMENT_PROVIDER_UNAVAILABLE' });
    await expect(callRazorpay('create order', () => Promise.reject(sdkError))).rejects.not.toHaveProperty(
      'message',
      expect.stringContaining('Authentication failed'),
    );
  });

  it('passes our own AppErrors through unchanged', async () => {
    const ours = new AppError('Payment has not been captured', 409, 'PAYMENT_NOT_CAPTURED');
    await expect(callRazorpay('verify', () => Promise.reject(ours))).rejects.toBe(ours);
  });
});
