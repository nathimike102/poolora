import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { RateLimitError } from '../utils/AppError';
import { config } from '../config';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

interface LocalWindow {
  count: number;
  resetAt: number;
}

/**
 * Per-process fallback used while Redis is unavailable. Limits are enforced per
 * instance rather than cluster-wide, which is weaker but far better than
 * letting login and OTP endpoints run unthrottled.
 */
const localWindows = new Map<string, LocalWindow>();
const LOCAL_MAX_KEYS = 50_000;

function hitLocal(key: string, windowMs: number): { count: number; ttlSeconds: number } {
  const now = Date.now();
  let entry = localWindows.get(key);
  if (!entry || entry.resetAt <= now) {
    if (localWindows.size >= LOCAL_MAX_KEYS) {
      for (const [k, v] of localWindows) {
        if (v.resetAt <= now) localWindows.delete(k);
      }
      if (localWindows.size >= LOCAL_MAX_KEYS) localWindows.clear();
    }
    entry = { count: 0, resetAt: now + windowMs };
    localWindows.set(key, entry);
  }
  entry.count += 1;
  return { count: entry.count, ttlSeconds: Math.ceil((entry.resetAt - now) / 1000) };
}

async function hitRedis(key: string, windowMs: number): Promise<{ count: number; ttlSeconds: number } | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const windowSeconds = Math.ceil(windowMs / 1000);
    // INCR and EXPIRE NX in one round trip so a crash can't leave a key without a TTL.
    const results = await redis.multi().incr(key).expire(key, windowSeconds, 'NX').ttl(key).exec();
    if (!results) return null;
    const count = Number(results[0][1]);
    const ttlSeconds = Number(results[2][1]);
    return { count, ttlSeconds: ttlSeconds > 0 ? ttlSeconds : windowSeconds };
  } catch (error) {
    logger.warn('Rate limiter falling back to in-memory store', { error: (error as Error).message });
    return null;
  }
}

function createRateLimiter(tier: RateLimitConfig, keyPrefix: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const identifier = (req as any).user?.userId || req.ip || 'unknown';
    const key = `ratelimit:${keyPrefix}:${identifier}`;

    const hit = (await hitRedis(key, tier.windowMs)) ?? hitLocal(key, tier.windowMs);

    if (hit.count > tier.max) {
      next(new RateLimitError(`Rate limit exceeded. Try again in ${hit.ttlSeconds} seconds.`));
      return;
    }
    next();
  };
}

export const globalRateLimit = createRateLimiter(config.rateLimit.global, 'global');
export const authRateLimit = createRateLimiter(config.rateLimit.auth, 'auth');
export const otpRateLimit = createRateLimiter(config.rateLimit.otp, 'otp');
