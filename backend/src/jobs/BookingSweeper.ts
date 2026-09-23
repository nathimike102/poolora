/**
 * BookingSweeper.ts
 *
 * Time-based booking rules that no request triggers:
 * - card/UPI requests still unpaid after 15 minutes are cancelled (UC-R04)
 * - requests the driver has not answered in 6 hours, or whose ride has
 *   already left, expire and are refunded (UC-D03)
 * - rides nobody has booked are cancelled 1 hour before departure (UC-D02)
 *
 * Runs every minute. With Redis available, a short lock makes sure only one
 * backend instance sweeps at a time; without it every instance sweeps, which
 * is safe because each change is conditional on the current status.
 */

import { Booking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { Payment } from '../models/Payment';
import { BookingService } from '../services/BookingService';
import { EventBridge } from '../events';
import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { BookingStatus, PaymentStatus, RideStatus } from '../types';
import { logger } from '../utils/logger';

const LOCK_KEY = 'jobs:booking-sweeper';
const MINUTE = 60_000;

export interface SweepResult {
  unpaidCancelled: number;
  requestsExpired: number;
  emptyRidesCancelled: number;
}

export class BookingSweeper {
  private static timer: NodeJS.Timeout | null = null;
  private static bookingService = new BookingService();

  static start(intervalMs = config.ride.sweepIntervalMs): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runWithLock().catch((error) =>
        logger.error('Booking sweep failed', { error: (error as Error).message }),
      );
    }, intervalMs);
    this.timer.unref();
    logger.info('Booking sweeper started', { intervalMs });
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private static async runWithLock(): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
      const ttl = Math.max(config.ride.sweepIntervalMs - 5_000, 5_000);
      const acquired = await redis.set(LOCK_KEY, String(process.pid), 'PX', ttl, 'NX').catch(() => 'OK');
      if (acquired !== 'OK') return;
    }
    const result = await this.runOnce();
    if (result.unpaidCancelled || result.requestsExpired || result.emptyRidesCancelled) {
      logger.info('Booking sweep', result);
    }
  }

  static async runOnce(now = new Date()): Promise<SweepResult> {
    return {
      unpaidCancelled: await this.cancelUnpaidRequests(now),
      requestsExpired: await this.expireUnansweredRequests(now),
      emptyRidesCancelled: await this.cancelEmptyRides(now),
    };
  }

  private static async cancelUnpaidRequests(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - config.ride.paymentTimeoutMins * MINUTE);
    const candidates = await Booking.find({
      status: BookingStatus.PENDING,
      razorpayOrderId: { $exists: true, $ne: null },
      createdAt: { $lt: cutoff },
    }).select('_id razorpayOrderId');

    let count = 0;
    for (const booking of candidates) {
      const paid = await Payment.exists({
        razorpayOrderId: booking.razorpayOrderId,
        status: { $in: [PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED] },
      });
      if (paid) continue;
      const done = await this.bookingService.expireBooking(
        booking._id.toString(),
        BookingStatus.CANCELLED,
        `Payment was not completed within ${config.ride.paymentTimeoutMins} minutes`,
      );
      if (done) count++;
    }
    return count;
  }

  private static async expireUnansweredRequests(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - config.ride.requestExpiryHours * 60 * MINUTE);
    // Pending requests are few at any time, so check each one's ride directly
    const pending = await Booking.find({ status: BookingStatus.PENDING })
      .select('_id createdAt ride')
      .populate<{ ride: { departureTime?: Date } | null }>('ride', 'departureTime')
      .lean();
    const stale = pending.filter(
      (b) => b.createdAt < cutoff || !b.ride?.departureTime || b.ride.departureTime < now,
    );

    let count = 0;
    for (const { _id } of stale) {
      const done = await this.bookingService.expireBooking(
        _id.toString(),
        BookingStatus.REJECTED,
        'The driver did not respond in time',
      );
      if (done) count++;
    }
    return count;
  }

  private static async cancelEmptyRides(now: Date): Promise<number> {
    const windowMs = config.ride.emptyRideCancelMins * MINUTE;
    const rides = await Ride.find({
      status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE] },
      departureTime: { $lte: new Date(now.getTime() + windowMs) },
      // A ride posted inside the window gets the full window before it is dropped
      createdAt: { $lt: new Date(now.getTime() - windowMs) },
    }).select('_id driver');

    let count = 0;
    for (const ride of rides) {
      const booked = await Booking.exists({
        ride: ride._id,
        status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      });
      if (booked) continue;

      const reason = 'Nobody booked a seat before departure';
      const cancelled = await Ride.findOneAndUpdate(
        { _id: ride._id, status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE] } },
        { $set: { status: RideStatus.CANCELLED, cancelledAt: now, cancellationReason: reason } },
      );
      if (!cancelled) continue;
      count++;
      EventBridge.publish('ride-events', {
        eventType: 'ride.cancelled',
        data: { rideId: ride._id, driverId: ride.driver, reason, automatic: true },
      });
    }
    return count;
  }
}
