/**
 * ProductAnalyticsService.ts
 *
 * Product analytics, as set out in docs/ANALYTICS_PLAN.md.
 *
 * - Activity: one UserActivity row per signed-in user per local day, written
 *   by the auth middleware. Daily, weekly and monthly actives and retention
 *   come from it.
 * - Errors: daily counts per error id in Redis, for the top-errors list.
 * - Events: domain events (EventBridge.publish) become the tracking-plan
 *   events and go to PostHog, in production only (utils/posthog.ts).
 * - KPIs: kpis() builds the web admin's Analytics page.
 *
 * Admins are left out of all of it, and only signed-in use is counted, so
 * bots and crawlers never appear. Events carry ids and coarse properties
 * only: never a phone number, name, location, token or message.
 */

import { Types } from 'mongoose';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { UserActivity } from '../models/UserActivity';
import { getRedisClient } from '../config/redis';
import { REGION, toLocalClock } from '../config/region';
import { BookingStatus, UserCapability } from '../types';
import { capture, posthogEnabled } from '../utils/posthog';
import { requestStats } from '../utils/requestStats';
import { logger } from '../utils/logger';

const DAY = 86_400_000;
const ERROR_DAYS_KEPT = 9;

/** The local calendar day of a moment, YYYY-MM-DD */
export function localDay(date: Date): string {
  return toLocalClock(date).toISOString().slice(0, 10);
}

/** Local midnight at the start of `date`'s day, as a real instant */
function startOfLocalDay(date: Date): Date {
  return new Date(Date.parse(`${localDay(date)}T00:00:00Z`) - REGION.utcOffsetMs);
}

/** The last `count` local days, oldest first, ending with today */
function lastDays(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => localDay(new Date(now.getTime() - (count - 1 - i) * DAY)));
}

const notAdmin = { capabilities: { $ne: UserCapability.ADMIN } };

// ─── Activity ────────────────────────────────────────────────────────────────

/** Users already recorded today by this process, so each is written once a day */
let seenDay = '';
const seen = new Set<string>();

export function recordActivity(userId: string, capabilities: readonly string[], now = new Date()): void {
  if (capabilities.includes(UserCapability.ADMIN) || !Types.ObjectId.isValid(userId)) return;
  const day = localDay(now);
  if (day !== seenDay) {
    seenDay = day;
    seen.clear();
  }
  if (seen.has(userId)) return;
  seen.add(userId);
  UserActivity.updateOne({ user: userId, day }, { $setOnInsert: { createdAt: now } }, { upsert: true }).catch((error) => {
    // Two servers recording the same user at once: the other one won
    if ((error as { code?: number }).code === 11000) return;
    seen.delete(userId);
    logger.warn('Could not record activity', { error: (error as Error).message });
  });
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * An error a signed-in user was shown (`userId` set), or any server fault.
 * `route` is the route pattern ("/bookings/:id/cancel"), never the real URL.
 * Admins' errors are left out, as admins are from every other figure.
 */
export function recordError(errorId: string, status: number, route: string, userId?: string, capabilities: readonly string[] = [], now = new Date()): void {
  if (capabilities.includes(UserCapability.ADMIN)) return;
  if (!userId && status < 500) return;
  const redis = getRedisClient();
  if (redis) {
    const key = `analytics:errors:${localDay(now)}`;
    redis.pipeline().hincrby(key, errorId, 1).expire(key, ERROR_DAYS_KEPT * 86_400).exec().catch(() => undefined);
  }
  if (userId) capture(userId, 'error_shown', { code: errorId, status, route });
}

// ─── Tracking-plan events ────────────────────────────────────────────────────

type EventData = Record<string, unknown>;
interface Mapping {
  name: string;
  actor: (data: EventData) => string | undefined | Promise<string | undefined>;
  props?: (data: EventData) => Record<string, unknown>;
}

const str = (value: unknown) => (value === undefined || value === null ? undefined : String(value));

/** Hours since an account was created, from the time inside its ObjectId */
function accountAgeHours(userId: string): number | undefined {
  if (!Types.ObjectId.isValid(userId)) return undefined;
  return Math.round((Date.now() - new Types.ObjectId(userId).getTimestamp().getTime()) / 3_600_000);
}

async function riderOf(bookingId: unknown): Promise<string | undefined> {
  if (!Types.ObjectId.isValid(String(bookingId))) return undefined;
  const booking = await Booking.findById(String(bookingId)).select('rider').lean();
  return booking ? String(booking.rider) : undefined;
}

/** Domain event → tracking-plan event (docs/ANALYTICS_PLAN.md) */
export const EVENT_MAP: Record<string, Mapping> = {
  'user.registered': { name: 'user_signed_up', actor: (d) => str(d.userId), props: (d) => ({ method: d.provider === 'firebase' ? 'firebase' : 'phone_otp' }) },
  'user.logged_in': { name: 'user_logged_in', actor: (d) => str(d.userId), props: (d) => ({ method: d.provider === 'firebase' ? 'firebase' : 'phone_otp' }) },
  'ride.created': { name: 'ride_published', actor: (d) => str(d.driverId), props: (d) => ({ ride_id: str(d.rideId) }) },
  'booking.created': { name: 'booking_requested', actor: (d) => str(d.riderId), props: (d) => ({ booking_id: str(d.bookingId), ride_id: str(d.rideId) }) },
  'booking.confirmed': { name: 'booking_confirmed', actor: (d) => str(d.riderId), props: (d) => ({ booking_id: str(d.bookingId) }) },
  'payment.captured': { name: 'payment_completed', actor: (d) => str(d.userId), props: (d) => ({ booking_id: str(d.bookingId), amount_usd: d.amount }) },
  'booking.completed': { name: 'trip_completed', actor: (d) => riderOf(d.bookingId), props: (d) => ({ booking_id: str(d.bookingId), fare_usd: d.finalFare }) },
  'booking.cancelled': { name: 'booking_cancelled', actor: (d) => str(d.riderId), props: (d) => ({ booking_id: str(d.bookingId), cancelled_by: d.cancelledBy }) },
  'kyc.submitted': { name: 'driver_application_submitted', actor: (d) => str(d.userId) },
  'kyc.approved': {
    name: 'onboarding_completed',
    actor: (d) => str(d.userId),
    props: (d) => ({ flow: 'driver', duration_hours: accountAgeHours(String(d.userId)) }),
  },
  'sos.triggered': { name: 'sos_raised', actor: (d) => str(d.triggeredBy) },
};

/** Whether a user is an admin, cached so a busy event stream costs few lookups */
const adminCache = new Map<string, { admin: boolean; at: number }>();
async function isAdmin(userId: string): Promise<boolean> {
  const hit = adminCache.get(userId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.admin;
  const user = Types.ObjectId.isValid(userId) ? await User.findById(userId).select('capabilities').lean() : null;
  const admin = Boolean(user?.capabilities?.includes(UserCapability.ADMIN));
  if (adminCache.size > 10_000) adminCache.clear();
  adminCache.set(userId, { admin, at: Date.now() });
  return admin;
}

/** Called for every published domain event. Best effort and never throws. */
export function trackDomainEvent(eventType: string, data: unknown): void {
  const mapping = EVENT_MAP[eventType];
  if (!mapping || !posthogEnabled()) return;
  void (async () => {
    const payload = (data ?? {}) as EventData;
    const actor = await mapping.actor(payload);
    if (!actor || (await isAdmin(actor))) return;
    capture(actor, mapping.name, { market: REGION.country, ...mapping.props?.(payload) });
  })().catch((error) => logger.warn('Analytics event failed', { eventType, error: (error as Error).message }));
}

// ─── KPIs for the web admin ──────────────────────────────────────────────────

export class ProductAnalyticsService {
  async kpis(now = new Date()) {
    const today = localDay(now);
    const days30 = lastDays(now, 30);
    const since30 = startOfLocalDay(new Date(now.getTime() - 29 * DAY));
    const since7 = startOfLocalDay(new Date(now.getTime() - 6 * DAY));

    const [total, signupsByDay, dau, wau, mau, activeByDay, activation, retention, funnel] = await Promise.all([
      User.countDocuments(notAdmin),
      User.aggregate<{ _id: string; count: number }>([
        { $match: { ...notAdmin, createdAt: { $gte: since30 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: REGION.timeZone } }, count: { $sum: 1 } } },
      ]),
      UserActivity.countDocuments({ day: today }),
      this.distinctActive(days30.slice(-7)),
      this.distinctActive(days30),
      UserActivity.aggregate<{ _id: string; count: number }>([
        { $match: { day: { $in: days30 } } },
        { $group: { _id: '$day', count: { $sum: 1 } } },
      ]),
      this.activation(since30),
      Promise.all([1, 7, 30].map((n) => this.retention(n, now))),
      this.funnel(since30),
    ]);

    const signups = new Map(signupsByDay.map((r) => [r._id, r.count]));
    const active = new Map(activeByDay.map((r) => [r._id, r.count]));
    const live = requestStats();

    return {
      generatedAt: now.toISOString(),
      timeZone: REGION.timeZone,
      users: {
        total,
        signups: {
          today: signups.get(today) ?? 0,
          week: days30.slice(-7).reduce((sum, d) => sum + (signups.get(d) ?? 0), 0),
          month: days30.reduce((sum, d) => sum + (signups.get(d) ?? 0), 0),
          daily: days30.map((day) => ({ day, count: signups.get(day) ?? 0 })),
        },
        // Users who signed up since the start of the week window
        newThisWeekSince: since7.toISOString(),
      },
      active: {
        dau,
        wau,
        mau,
        /** Share of the month's actives who came back today */
        stickiness: mau ? dau / mau : null,
        daily: days30.map((day) => ({ day, count: active.get(day) ?? 0 })),
      },
      activation,
      retention,
      funnel,
      errors: {
        live: { requests: live.requests, errorRate: live.errorRate },
        top7d: await this.topErrors(now),
      },
      posthog: posthogEnabled(),
    };
  }

  private async distinctActive(days: string[]): Promise<number> {
    const [row] = await UserActivity.aggregate<{ n: number }>([
      { $match: { day: { $in: days } } },
      { $group: { _id: '$user' } },
      { $count: 'n' },
    ]);
    return row?.n ?? 0;
  }

  /** Of the last 30 days' sign-ups, how many booked a seat or published a ride */
  private async activation(since: Date) {
    const cohort = await User.find({ ...notAdmin, createdAt: { $gte: since } }).distinct('_id');
    if (!cohort.length) return { cohort: 0, activated: 0, rate: null };
    const [riders, drivers] = await Promise.all([
      Booking.distinct('rider', { rider: { $in: cohort } }),
      Ride.distinct('driver', { driver: { $in: cohort } }),
    ]);
    const activated = new Set([...riders, ...drivers].map(String)).size;
    return { cohort: cohort.length, activated, rate: activated / cohort.length };
  }

  /**
   * Day-N retention: of the people who signed up in the 90 days before the
   * last complete day-N window, the share who used the app on day N after
   * signing up.
   */
  private async retention(n: number, now: Date) {
    const to = startOfLocalDay(new Date(now.getTime() - n * DAY));
    const from = new Date(to.getTime() - 90 * DAY);
    const [row] = await User.aggregate<{ cohort: number; retained: number }>([
      { $match: { ...notAdmin, createdAt: { $gte: from, $lt: to } } },
      {
        $project: {
          target: { $dateToString: { format: '%Y-%m-%d', date: { $dateAdd: { startDate: '$createdAt', unit: 'day', amount: n } }, timezone: REGION.timeZone } },
        },
      },
      {
        $lookup: {
          from: UserActivity.collection.name,
          let: { user: '$_id', day: '$target' },
          pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$user', '$$user'] }, { $eq: ['$day', '$$day'] }] } } }, { $limit: 1 }],
          as: 'hit',
        },
      },
      { $group: { _id: null, cohort: { $sum: 1 }, retained: { $sum: { $cond: [{ $gt: [{ $size: '$hit' }, 0] }, 1, 0] } } } },
    ]);
    const cohort = row?.cohort ?? 0;
    const retained = row?.retained ?? 0;
    return { day: n, cohort, retained, rate: cohort ? retained / cohort : null };
  }

  /** The rider's main flow, for people who signed up in the last 30 days */
  private async funnel(since: Date) {
    const cohort = await User.find({ ...notAdmin, createdAt: { $gte: since } }).distinct('_id');
    const riders = (filter: Record<string, unknown>) =>
      cohort.length ? Booking.distinct('rider', { rider: { $in: cohort }, ...filter }).then((ids) => ids.length) : Promise.resolve(0);
    const [requested, confirmed, completed] = await Promise.all([
      riders({}),
      riders({ status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } }),
      riders({ status: BookingStatus.COMPLETED }),
    ]);
    return [
      { step: 'signed_up', label: 'Signed up', users: cohort.length },
      { step: 'booking_requested', label: 'Requested a seat', users: requested },
      { step: 'booking_confirmed', label: 'Seat confirmed', users: confirmed },
      { step: 'trip_completed', label: 'Completed a trip', users: completed },
    ];
  }

  private async topErrors(now: Date) {
    const redis = getRedisClient();
    if (!redis) return null;
    try {
      const rows = await Promise.all(lastDays(now, 7).map((day) => redis.hgetall(`analytics:errors:${day}`)));
      const totals = new Map<string, number>();
      for (const row of rows) for (const [id, count] of Object.entries(row)) totals.set(id, (totals.get(id) ?? 0) + Number(count));
      return [...totals].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    } catch {
      return null;
    }
  }
}
