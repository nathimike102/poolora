import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { RateLimitError } from '../utils/AppError';
import { config } from '../config';
import { logger } from '../utils/logger';
import { toE164 } from '../config/region';

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

/** "45 seconds", "1 minute", "44 minutes", "2 hours": a wait people can read at a glance. */
export function describeWait(seconds: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (seconds < 60) return plural(Math.max(1, seconds), 'second');
  if (seconds < 3600) return plural(Math.ceil(seconds / 60), 'minute');
  return plural(Math.ceil(seconds / 3600), 'hour');
}

type KeyOf = (req: Request) => string;

const byUserOrIp: KeyOf = (req) => req.user?.userId || req.ip || 'unknown';
const byIp: KeyOf = (req) => req.ip || 'unknown';
/** The phone in the body, normalised, so "0771…" and "+263771…" share a count */
const byPhone: KeyOf = (req) => {
  const raw = typeof req.body?.phone === 'string' ? req.body.phone : '';
  return `phone:${toE164(raw) ?? raw.replace(/\s/g, '').slice(0, 20)}`;
};

/** Checks one request against a limit. Resolves true when it is over. */
export async function overLimit(key: string, tier: RateLimitConfig): Promise<{ over: boolean; ttlSeconds: number }> {
  const hit = (await hitRedis(key, tier.windowMs)) ?? hitLocal(key, tier.windowMs);
  return { over: hit.count > tier.max, ttlSeconds: hit.ttlSeconds };
}

function createRateLimiter(tier: RateLimitConfig, keyPrefix: string, keyOf: KeyOf = byUserOrIp, skip?: (req: Request) => boolean) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (skip?.(req)) return next();
    const { over, ttlSeconds } = await overLimit(`ratelimit:${keyPrefix}:${keyOf(req)}`, tier);
    if (over) {
      next(new RateLimitError(`Too many requests. Try again in ${describeWait(ttlSeconds)}.`));
      return;
    }
    next();
  };
}

/**
 * Callbacks from Paynow, Twilio and the background-check vendor come from a
 * few IPs, carry their own signatures, and must not be turned away at volume.
 */
const SIGNED_CALLBACK = /^\/(api\/v1\/)?(payments\/paynow\/result|calls\/twilio\/|kyc-verify\/callback)/;

export const globalRateLimit = createRateLimiter(config.rateLimit.global, 'ip', byIp, (req) => SIGNED_CALLBACK.test(req.originalUrl));
export const authRateLimit = createRateLimiter(config.rateLimit.auth, 'auth', byIp);
export const otpRateLimit = [
  createRateLimiter(config.rateLimit.otpIp, 'otp-ip', byIp),
  createRateLimiter(config.rateLimit.otp, 'otp', byPhone),
];
export const verifyRateLimit = [
  createRateLimiter(config.rateLimit.verifyIp, 'verify-ip', byIp),
  createRateLimiter(config.rateLimit.verify, 'verify', byPhone),
];

/** Per signed-in user; called by authenticate once the user is known */
export async function checkUserRateLimit(userId: string): Promise<void> {
  const { over, ttlSeconds } = await overLimit(`ratelimit:user:${userId}`, config.rateLimit.user);
  if (over) throw new RateLimitError(`Too many requests. Try again in ${describeWait(ttlSeconds)}.`);
}
