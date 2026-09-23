import { AppError } from './AppError';
import { logger } from './logger';

/** The rejection shape of the Razorpay SDK: `{ statusCode, error: { code, description } }`. */
interface RazorpaySdkError {
  statusCode?: number;
  error?: { code?: string; description?: string };
}

/**
 * Run a Razorpay API call, turning a provider failure (bad keys, outage, rejected
 * request) into a 502 users can act on instead of an unhandled 500. The provider's
 * own description is logged for operators and never shown to users.
 */
export async function callRazorpay<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) throw error;
    const sdkError = error as RazorpaySdkError;
    logger.error('Razorpay request failed', {
      operation,
      statusCode: sdkError?.statusCode,
      code: sdkError?.error?.code,
      description: sdkError?.error?.description ?? (error as Error)?.message,
    });
    throw new AppError(
      'Online payments are unavailable right now. Please try again later or pay from your wallet.',
      502,
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  }
}
