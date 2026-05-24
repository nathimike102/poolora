import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { UnifiedAuthService } from '../auth';
import { AuthenticationError } from '../utils/AppError';
import { JWTPayload, AuthenticatedRequest } from '../types';

const unifiedAuth = new UnifiedAuthService();

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
    const token = extractToken(req);

    if (!token) {
      throw new AuthenticationError('Access token is required');
    }

    const result = await unifiedAuth.authenticate(token);

    // Build a JWTPayload-compatible object so downstream code is unaffected
    const payload: JWTPayload = {
      userId: result.user._id.toString(),
      phone: result.user.phone,
      capabilities: result.user.capabilities,
      driverVerified: result.user.kyc.status === 'approved',
      sessionId: result.sessionId || 'firebase',
    };

    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Alias for authenticate for consistent naming.
 */
export const requireAuth = authenticate;

/**
 * Middleware to check if the user has a specific capability.
 * Must be placed after authenticate.
 */
export function requireCapability(capability: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const hasCapability = user.capabilities.includes(capability as any);
    if (!hasCapability) {
      return next(new AuthenticationError(`Missing required capability: ${capability}`));
    }

    next();
  };
}

/**
 * Optional authentication — attaches user if token present, otherwise continues.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      next();
      return;
    }

    const payload = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
    const redis = getRedisClient();
    if (redis) {
      const sessionExists = await redis.exists(`session:${payload.userId}:${payload.sessionId}`);
      if (sessionExists) {
        (req as AuthenticatedRequest).user = payload;
      }
    } else {
      // Redis unavailable — trust the JWT
      (req as AuthenticatedRequest).user = payload;
    }
  } catch {
    // Silently ignore invalid tokens in optional auth
  }

  next();
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
