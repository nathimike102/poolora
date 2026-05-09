import jwt from 'jsonwebtoken';
import { AuthStrategy, AuthResult, AuthProvider } from '../AuthStrategy';
import { config } from '../../config';
import { getRedisClient } from '../../config/redis';
import { User } from '../../models/User';
import { JWTPayload } from '../../types';
import { AuthenticationError } from '../../utils/AppError';

/**
 * Verifies access tokens issued by the custom OTP → JWT system.
 *
 * This is the same logic that lives in middlewares/auth.middleware.ts,
 * extracted into a strategy so the unified AuthService can use it as
 * a fallback when AUTH_PROVIDER = hybrid.
 */
export class JwtAuthStrategy implements AuthStrategy {
  async authenticate(token: string): Promise<AuthResult> {
    let payload: JWTPayload;

    try {
      payload = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Access token has expired');
      }
      throw new AuthenticationError('Invalid access token');
    }

    // Validate session in Redis (skip if Redis is down — fail-open)
    const redis = getRedisClient();
    if (redis) {
      const sessionKey = `session:${payload.userId}:${payload.sessionId}`;
      const sessionExists = await redis.exists(sessionKey);
      if (!sessionExists) {
        throw new AuthenticationError('Session expired or invalidated');
      }

      const blacklisted = await redis.get(`blacklist:user:${payload.userId}`);
      if (blacklisted) {
        throw new AuthenticationError('Account has been suspended');
      }
    }

    // Fetch full user document to return a consistent AuthResult
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    return {
      user,
      provider: AuthProvider.CUSTOM,
      sessionId: payload.sessionId,
    };
  }
}
