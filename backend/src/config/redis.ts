import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';

let redisClient: Redis | null = null;
let redisPub: Redis | null = null;
let redisSub: Redis | null = null;

function createRedisClient(name: string): Redis {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  client.on('connect', () => logger.info(`Redis ${name} connected`));
  client.on('error', () => { }); // Suppress noisy reconnect errors — handled at connect level

  return client;
}

export async function connectRedis(): Promise<void> {
  redisClient = createRedisClient('main');
  redisPub = createRedisClient('pub');
  redisSub = createRedisClient('sub');

  try {
    await Promise.all([
      redisClient.connect(),
      redisPub.connect(),
      redisSub.connect(),
    ]);
  } catch (err) {
    // Disconnect all clients to prevent background retry rejections
    await Promise.allSettled([
      redisClient.disconnect(),
      redisPub.disconnect(),
      redisSub.disconnect(),
    ]);
    redisClient = null;
    redisPub = null;
    redisSub = null;
    throw err;
  }
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Like getRedisClient() but throws a 503 if Redis is not connected.
 * Use in service methods that require Redis to function.
 */
export function requireRedis(): Redis {
  if (!redisClient) {
    throw new AppError('Redis is not connected. Cannot process request.', 503, 'SERVICE_UNAVAILABLE');
  }
  return redisClient;
}

export function getRedisPub(): Redis | null {
  return redisPub;
}

export function getRedisSub(): Redis | null {
  return redisSub;
}

export async function disconnectRedis(): Promise<void> {
  await Promise.allSettled([
    redisClient?.quit().catch(() => { }),
    redisPub?.quit().catch(() => { }),
    redisSub?.quit().catch(() => { }),
  ]);
  logger.info('Redis disconnected gracefully');
}
