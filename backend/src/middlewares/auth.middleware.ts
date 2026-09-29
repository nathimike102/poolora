import { Request, Response, NextFunction } from 'express';
import { UnifiedAuthService } from '../auth';
import { getRedisClient } from '../config/redis';
import { AuthenticationError } from '../utils/AppError';
import { checkAccountStatus } from './accountStatus.middleware';
import { JWTPayload, AuthenticatedRequest, UserCapability } from '../types';

const unifiedAuth = new UnifiedAuthService();

/**
 * Counts distinct signed-in users per hour for the admin dashboard, in a
 * Redis HyperLogLog (about 12 KB per hour however many users). Best effort.
 */
function markActive(userId: string): void {
  const redis = getRedisClient();
  if (!redis) return;
  const key = `active:users:${new Date().toISOString().slice(0, 13)}`;
  redis.pipeline().pfadd(key, userId).expire(key, 3 * 3600).exec().catch(() => undefined);
}

/**
 * Validates the access token from Authorization header or cookie.
 *
 * Delegates to UnifiedAuthService which routes to the correct strategy
 * based on the AUTH_PROVIDER env variable (firebase | custom | hybrid).
 *
 * For backward compatibility the middleware still populates req.user
 * with a JWTPayload-shaped object so every downstream controller,
 * capability guard, and socket auth keeps working unchanged.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Dev bypass: attaches a fake admin so developers can test flows without
    // real auth. Requires NODE_ENV to be *explicitly* "development", so a
    // staging or production deploy with NODE_ENV unset can never enable it.
    if (process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
      const payload: JWTPayload = {
        userId: 'dev-user',
        phone: '+10000000000',
        capabilities: [UserCapability.RIDER, UserCapability.DRIVER, UserCapability.ADMIN],
        driverVerified: true,
        sessionId: 'dev-session',
      };
      (req as AuthenticatedRequest).user = payload;
      next();
      return;
    }

    const token = extractToken(req);

    if (!token) {
      throw new AuthenticationError('Access token is required');
    }

    const result = await unifiedAuth.authenticate(token);
    // Blocked accounts reach only the appeal endpoints
    const appealPath = /^\/(api\/v1\/)?appeals(\/|$|\?)/.test(req.originalUrl);
    const accountStatus = await checkAccountStatus(result.user, { allowBlocked: appealPath });

    // Build a JWTPayload-compatible object so downstream code is unaffected
    const payload: JWTPayload = {
      userId: result.user._id.toString(),
      phone: result.user.phone,
      capabilities: result.user.capabilities,
      driverVerified: result.user.kyc.status === 'approved',
      sessionId: result.sessionId || 'firebase',
      accountStatus,
      suspendedUntil: accountStatus === 'suspended' ? result.user.suspendedUntil : undefined,
    };

    (req as AuthenticatedRequest).user = payload;
    markActive(payload.userId);
    next();
  } catch (error) {
    next(error);
  }
}

function extractToken(req: Request): string | null {
  // 1. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 2. Check cookie
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }

  return null;
}
