/**
 * AlertMonitor.ts
 *
 * Checks the admins' alert rules every minute (UC-A02, UC-A06) and sends
 * emails and SMS for the ones that fire. With Redis, a short lock keeps the
 * check to one backend instance, so nobody is paged twice.
 */

import { AlertRuleService } from '../services/AlertRuleService';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

const LOCK_KEY = 'jobs:alert-monitor';
const INTERVAL_MS = 60_000;

export class AlertMonitor {
  private static timer: NodeJS.Timeout | null = null;
  private static service = new AlertRuleService();

  static start(intervalMs = INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runWithLock().catch((error) => logger.error('Alert monitor failed', { error: (error as Error).message }));
    }, intervalMs);
    this.timer.unref();
    logger.info('Alert monitor started', { intervalMs });
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private static async runWithLock(): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
      const acquired = await redis.set(LOCK_KEY, String(process.pid), 'PX', INTERVAL_MS - 5_000, 'NX').catch(() => 'OK');
      if (acquired !== 'OK') return;
    }
    const fired = await this.service.check();
    if (fired) logger.info('Alert rules fired', { fired });
  }
}
