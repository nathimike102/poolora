import type { JWTPayload } from './index';

/**
 * Properties our own middleware attaches to every request.
 *
 * requestId is set by requestIdMiddleware for all requests, so it is always
 * present. user is set only after authenticate() has run, so it is optional
 * here: a handler behind that middleware narrows it, and one that is not has
 * to check. rawBody is captured only for routes that verify a webhook
 * signature over the exact bytes received.
 */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: JWTPayload;
      rawBody?: Buffer;
    }
  }
}

export {};
