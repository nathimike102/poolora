/**
 * SosMonitor.ts
 *
 * Watches open SOS incidents every 15 seconds (SafetyService.monitor): texts
 * emergency contacts once an SOS's cancel window has passed (a backup for
 * the in-process timer, so a restart loses nothing), marks phones that have
 * gone quiet, and pages the safety team again while nobody has taken an SOS.
 * With Redis, a short lock keeps each pass to one backend instance; every
 * write is also claimed atomically, so nothing is sent twice.
 */

import { SafetyService } from '../services/SafetyService';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

const LOCK_KEY = 'jobs:sos-monitor';
const INTERVAL_MS = 15_000;

export class SosMonitor {
  private static timer: NodeJS.Timeout | null = null;
  private static service = new SafetyService();

  static start(intervalMs = INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runWithLock(intervalMs).catch((error) => logger.error('SOS monitor failed', { error: (error as Error).message }));
    }, intervalMs);
    this.timer.unref();
    logger.info('SOS monitor started', { intervalMs });
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private static async runWithLock(intervalMs: number): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
      const acquired = await redis.set(LOCK_KEY, String(process.pid), 'PX', intervalMs - 2_000, 'NX').catch(() => 'OK');
      if (acquired !== 'OK') return;
    }
    const done = await this.service.monitor();
    if (done.contacts || done.lostContact || done.repaged) logger.warn('SOS monitor acted', done);
  }
}
