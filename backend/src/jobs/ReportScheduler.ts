/**
 * ReportScheduler.ts
 *
 * Emails the scheduled admin reports that are due (UC-A06). Checks every five
 * minutes. With Redis, a short lock keeps the check to one backend instance;
 * without it each schedule is still claimed atomically before it is sent, so
 * nothing goes out twice.
 */

import { ReportScheduleService } from '../services/ReportScheduleService';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

const LOCK_KEY = 'jobs:report-scheduler';
const INTERVAL_MS = 5 * 60_000;

export class ReportScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static service = new ReportScheduleService();

  static start(intervalMs = INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runWithLock().catch((error) =>
        logger.error('Report scheduler failed', { error: (error as Error).message }),
      );
    }, intervalMs);
    this.timer.unref();
    logger.info('Report scheduler started', { intervalMs });
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
    const sent = await this.service.runDue();
    if (sent) logger.info('Scheduled reports sent', { sent });
  }
}
