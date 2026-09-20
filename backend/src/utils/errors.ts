/**
 * A caught value is `unknown`: anything can be thrown, not just an Error.
 * These read the parts we log or branch on, without casting to any.
 */

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

/** The `code` property carried by Node, Mongo and Firebase errors. */
export function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string' || typeof code === 'number') return String(code);
  }
  return undefined;
}
