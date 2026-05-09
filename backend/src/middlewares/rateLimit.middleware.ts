import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { RateLimitError } from '../utils/AppError';
import { config } from '../config';

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

function createRateLimiter(tier: RateLimitConfig, keyPrefix: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient();
      if (!redis) { next(); return; } // Redis unavailable — fail-open
      const identifier = (req as any).user?.userId || req.ip || 'unknown';
      const key = `ratelimit:${keyPrefix}:${identifier}`;
      const windowSeconds = Math.ceil(tier.windowMs / 1000);

      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (current > tier.max) {
        const ttl = await redis.ttl(key);
        throw new RateLimitError(
          `Rate limit exceeded. Try again in ${ttl} seconds.`,
        );
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        // If Redis fails, allow the request (fail-open for availability)
        next();
      }
    }
  };
}

export const globalRateLimit = createRateLimiter(config.rateLimit.global, 'global');
export const authRateLimit = createRateLimiter(config.rateLimit.auth, 'auth');
export const otpRateLimit = createRateLimiter(config.rateLimit.otp, 'otp');
