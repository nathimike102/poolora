/**
 * InvoiceScheduler.ts
 *
 * Company bills (UC-C03). Every hour: bills last month for any company not
 * billed yet (from 06:00 on the 1st), emails bills not yet sent, and puts
 * companies with a bill over 30 days unpaid on hold. Every step is safe to
 * repeat, so a missed hour or a second backend instance changes nothing;
 * with Redis a lock keeps it to one instance anyway.
 */

import { InvoiceService } from '../services/InvoiceService';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

const LOCK_KEY = 'jobs:invoice-scheduler';
const INTERVAL_MS = 60 * 60_000;

export class InvoiceScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static service = new InvoiceService();

  static start(intervalMs = INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runWithLock().catch((error) => logger.error('Invoice scheduler failed', { error: (error as Error).message }));
    }, intervalMs);
    this.timer.unref();
    logger.info('Invoice scheduler started', { intervalMs });
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One pass: bill, email, enforce holds */
  static async run(now = new Date()): Promise<{ issued: number; emailed: number; held: number }> {
    const issued = await this.service.billMonth(this.service.billingMonth(now), now);
    const emailed = await this.service.emailDue();
    const held = await this.service.enforceHolds(now);
    if (issued.length || emailed || held) logger.info('Company billing', { issued: issued.length, emailed, held });
    return { issued: issued.length, emailed, held };
  }

  private static async runWithLock(): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
      const acquired = await redis.set(LOCK_KEY, String(process.pid), 'PX', INTERVAL_MS - 60_000, 'NX').catch(() => 'OK');
      if (acquired !== 'OK') return;
    }
    await this.run();
  }
}
