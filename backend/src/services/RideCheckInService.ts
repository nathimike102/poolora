/**
 * RideCheckInService.ts
 *
 * "Are you OK?" prompts for riders during a ride (UC-R05: every 30 minutes).
 * A prompt that goes unanswered is repeated after 10 minutes; a second miss,
 * or an answer of "I need help", raises an SOS so the safety team and the
 * rider's emergency contacts are alerted. Runs every minute with a Redis lock
 * so only one backend instance prompts.
 */

import { Booking, IBooking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { BookingStatus, RideStatus } from '../types';
import { AppError, AuthorizationError, ConflictError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { NotificationService } from './NotificationService';
import { SafetyService } from './SafetyService';

const MINUTE = 60_000;
const LOCK_KEY = 'jobs:ride-check-in';

async function lastKnownPosition(booking: IBooking): Promise<{ lng: number; lat: number }> {
  const redis = getRedisClient();
  const cached = redis ? await redis.get(`booking:${booking._id}:driver:location`).catch(() => null) : null;
  if (cached) {
    const { lng, lat } = JSON.parse(cached) as { lng: number; lat: number };
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
  }
  const [lng, lat] = booking.pickup.location.coordinates;
  return { lng, lat };
}

export class RideCheckInService {
  private notifications = new NotificationService();
  private safety = new SafetyService();
  private static timer: NodeJS.Timeout | null = null;

  static start(intervalMs = MINUTE): void {
    if (this.timer) return;
    const service = new RideCheckInService();
    this.timer = setInterval(async () => {
      try {
        const redis = getRedisClient();
        if (redis && (await redis.set(LOCK_KEY, String(process.pid), 'PX', intervalMs - 5_000, 'NX').catch(() => 'OK')) !== 'OK') return;
        await service.runDue();
      } catch (error) {
        logger.error('Ride check-in run failed', { error: (error as Error).message });
      }
    }, intervalMs);
    this.timer.unref();
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Sends due prompts and escalates missed ones. Returns what it did, for tests and logs. */
  async runDue(now = new Date()): Promise<{ prompted: number; escalated: number }> {
    const every = config.ride.safetyCheckInMins * MINUTE;
    const grace = config.ride.safetyCheckInGraceMins * MINUTE;
    const riding = await Booking.find({
      status: BookingStatus.CONFIRMED,
      actualPickupTime: { $exists: true },
      actualDropoffTime: { $exists: false },
    });
    let prompted = 0;
    let escalated = 0;

    for (const booking of riding) {
      const ride = await Ride.findById(booking.ride).select('status').lean();
      if (ride?.status !== RideStatus.IN_PROGRESS) continue;
      const check = booking.safetyCheck ?? { missed: 0 };
      const open = check.promptedAt && (!check.answeredAt || check.answeredAt < check.promptedAt);

      if (open) {
        if (now.getTime() - check.promptedAt!.getTime() < grace) continue;
        const missed = (check.missed ?? 0) + 1;
        if (missed >= 2) {
          await this.escalate(booking, 'The rider did not answer two safety check-ins in a row');
          booking.safetyCheck = { missed: 0, answeredAt: now };
          escalated++;
        } else {
          booking.safetyCheck = { missed, promptedAt: now };
          await this.prompt(booking, true);
          prompted++;
        }
        await booking.save();
        continue;
      }

      const since = check.answeredAt ?? booking.actualPickupTime!;
      if (now.getTime() - since.getTime() >= every) {
        booking.safetyCheck = { missed: check.missed ?? 0, promptedAt: now, answeredAt: check.answeredAt };
        await booking.save();
        await this.prompt(booking, false);
        prompted++;
      }
    }
    return { prompted, escalated };
  }

  /** The rider answers the prompt from the app. "help" raises an SOS at once. */
  async respond(userId: string, bookingId: string, status: 'ok' | 'help', location?: { lng: number; lat: number }) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    if (booking.rider.toString() !== userId) throw new AuthorizationError('Only the rider answers this check-in');
    if (booking.status !== BookingStatus.CONFIRMED) throw new ConflictError('This ride is not under way');
    if (status !== 'ok' && status !== 'help') throw new AppError('Answer ok or help', 422, 'VALIDATION_ERROR');

    booking.safetyCheck = { missed: 0, promptedAt: booking.safetyCheck?.promptedAt, answeredAt: new Date() };
    await booking.save();
    if (status === 'help') {
      const emergency = await this.escalate(booking, 'The rider asked for help at a safety check-in', location);
      return { status, emergencyId: emergency?._id };
    }
    return { status };
  }

  private async prompt(booking: IBooking, repeat: boolean): Promise<void> {
    const riderId = booking.rider.toString();
    const title = repeat ? 'Please confirm you are OK' : 'Are you OK?';
    const body = repeat
      ? 'We did not hear back. Tap to answer, or we will alert the safety team.'
      : 'A quick safety check during your ride. Tap to answer.';
    await this.notifications.sendPushNotification(riderId, title, body, { bookingId: booking._id.toString(), type: 'safety_check' }).catch(() => undefined);
    const { SocketGateway } = await import('../sockets/SocketGateway');
    SocketGateway.getInstance()?.getIO().to(`user:${riderId}`).emit('safety:check-in', { bookingId: booking._id.toString(), repeat });
  }

  private async escalate(booking: IBooking, reason: string, location?: { lng: number; lat: number }) {
    try {
      const where = location ?? (await lastKnownPosition(booking));
      const record = await this.safety.triggerSOS(booking.rider.toString(), { bookingId: booking._id.toString(), location: where });
      record.timeline.push({ event: 'Raised automatically', timestamp: new Date(), details: reason });
      await record.save();
      logger.warn('SOS raised from a safety check-in', { bookingId: booking._id, reason });
      return record;
    } catch (error) {
      // An SOS that is already open for this booking is fine: the team is on it
      logger.error('Could not raise SOS from a safety check-in', { bookingId: booking._id, error: (error as Error).message });
      return null;
    }
  }
}
