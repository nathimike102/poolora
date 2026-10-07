/**
 * Product analytics against a real MongoDB: the KPIs on the web admin's
 * Analytics page, the daily activity rows behind them, and the mapping from
 * domain events to tracking-plan events. Admins never count.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../config/redis', () => ({ getRedisClient: () => null }));
const capture = jest.fn();
jest.mock('../../utils/posthog', () => ({ capture: (...args: unknown[]) => capture(...args), posthogEnabled: () => true }));

import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { Ride } from '../../models/Ride';
import { UserActivity } from '../../models/UserActivity';
import { ProductAnalyticsService, EVENT_MAP, localDay, recordActivity, recordError, trackDomainEvent } from '../../services/ProductAnalyticsService';

jest.setTimeout(60_000);

const DAY = 86_400_000;
const NOW = new Date('2026-10-01T10:00:00Z'); // 12:00 in Harare
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

let mongo: MongoMemoryServer;
const service = new ProductAnalyticsService();

const ids = {
  rider: new Types.ObjectId(),
  driver: new Types.ObjectId(),
  idle: new Types.ObjectId(),
  veteran: new Types.ObjectId(),
  admin: new Types.ObjectId(),
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  capture.mockClear();
  await mongoose.connection.db!.dropDatabase();
  await UserActivity.syncIndexes();
  const user = (_id: Types.ObjectId, capabilities: string[], createdAt: Date) => ({
    _id, name: 'Test', phone: `+26377${_id.toString().slice(-7)}`, capabilities, kyc: { status: 'none' }, stats: {}, warnings: 0, createdAt,
  });
  await User.collection.insertMany([
    user(ids.rider, ['rider'], daysAgo(8)),
    user(ids.driver, ['rider', 'driver'], daysAgo(3)),
    user(ids.idle, ['rider'], daysAgo(2)),
    user(ids.veteran, ['rider'], daysAgo(200)),
    user(ids.admin, ['rider', 'admin'], daysAgo(1)),
  ]);
});

const active = (user: Types.ObjectId, ago: number) => ({ user, day: localDay(daysAgo(ago)), createdAt: daysAgo(ago) });

describe('activity', () => {
  it('writes one row per user per day and leaves admins out', async () => {
    recordActivity(ids.rider.toString(), ['rider'], NOW);
    recordActivity(ids.rider.toString(), ['rider'], NOW);
    recordActivity(ids.admin.toString(), ['rider', 'admin'], NOW);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const rows = await UserActivity.find().lean();
    expect(rows).toHaveLength(1);
    expect(String(rows[0].user)).toBe(ids.rider.toString());
    expect(rows[0].day).toBe('2026-10-01');
  });
});

describe('kpis', () => {
  beforeEach(async () => {
    await UserActivity.collection.insertMany([
      // The rider signed up 8 days ago: back on day 1 (7 days ago) and today, not on day 7
      active(ids.rider, 7), active(ids.rider, 0),
      // The driver signed up 3 days ago: back on day 1 (2 days ago) and today
      active(ids.driver, 2), active(ids.driver, 0),
      active(ids.veteran, 20),
      // No row for the admin: recordActivity never writes one
    ]);
    const ride = new Types.ObjectId();
    await Ride.collection.insertOne({ _id: ride, driver: ids.driver, status: 'scheduled', createdAt: daysAgo(2) });
    await Booking.collection.insertMany([
      { ride, rider: ids.rider, driver: ids.driver, status: 'completed', createdAt: daysAgo(5) },
      { ride, rider: ids.idle, driver: ids.driver, status: 'cancelled', createdAt: daysAgo(1) },
    ]);
  });

  it('counts users, sign-ups and actives without admins', async () => {
    const k = await service.kpis(NOW);
    expect(k.users.total).toBe(4);
    expect(k.users.signups).toMatchObject({ today: 0, week: 2, month: 3 });
    expect(k.users.signups.daily).toHaveLength(30);
    expect(k.active).toMatchObject({ dau: 2, wau: 2, mau: 3 });
    expect(k.active.daily.at(-1)).toEqual({ day: '2026-10-01', count: 2 });
  });

  it('measures activation as a first booking or a published ride', async () => {
    const k = await service.kpis(NOW);
    // rider booked, idle requested a seat (it was cancelled), driver published a ride
    expect(k.activation).toEqual({ cohort: 3, activated: 3, rate: 1 });
  });

  it('measures day-N retention from complete windows only', async () => {
    const k = await service.kpis(NOW);
    const d1 = k.retention.find((r) => r.day === 1)!;
    const d7 = k.retention.find((r) => r.day === 7)!;
    // Day 1 cohorts: rider (back on day 1), driver (back on day 1), idle (not back); the admin is out
    expect(d1).toMatchObject({ cohort: 3, retained: 2 });
    // Day 7 cohort: only the rider has had seven days, and was not back on day 7
    expect(d7).toMatchObject({ cohort: 1, retained: 0, rate: 0 });
  });

  it('follows the rider funnel', async () => {
    const k = await service.kpis(NOW);
    expect(k.funnel.map((s) => s.users)).toEqual([3, 2, 1, 1]);
  });
});

describe('tracking-plan events', () => {
  it('maps domain events to the documented names', () => {
    expect(Object.fromEntries(Object.entries(EVENT_MAP).map(([k, v]) => [k, v.name]))).toMatchObject({
      'user.registered': 'user_signed_up',
      'user.logged_in': 'user_logged_in',
      'booking.created': 'booking_requested',
      'kyc.approved': 'onboarding_completed',
    });
  });

  it('sends ids and coarse properties, never the phone number', async () => {
    trackDomainEvent('user.registered', { userId: ids.rider.toString(), phone: '+263771234567' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(capture).toHaveBeenCalledWith(ids.rider.toString(), 'user_signed_up', expect.objectContaining({ method: 'phone_otp' }));
    expect(JSON.stringify(capture.mock.calls)).not.toContain('+263771234567');
  });

  it('tags a sign-up through Firebase as one, and leaves admins\' errors out', async () => {
    trackDomainEvent('user.registered', { userId: ids.rider.toString(), provider: 'firebase' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(capture).toHaveBeenCalledWith(ids.rider.toString(), 'user_signed_up', expect.objectContaining({ method: 'firebase' }));
    capture.mockClear();
    recordError('FORBIDDEN', 403, '/admin/users', ids.admin.toString(), ['rider', 'admin']);
    expect(capture).not.toHaveBeenCalled();
    recordError('NOT_FOUND', 404, '/bookings/:id', ids.rider.toString(), ['rider']);
    expect(capture).toHaveBeenCalledWith(ids.rider.toString(), 'error_shown', expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('leaves admins out and finds the rider of a completed trip', async () => {
    trackDomainEvent('user.logged_in', { userId: ids.admin.toString() });
    const booking = await Booking.collection.insertOne({ rider: ids.rider, status: 'completed' });
    trackDomainEvent('booking.completed', { bookingId: booking.insertedId.toString(), finalFare: 4 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(ids.rider.toString(), 'trip_completed', expect.objectContaining({ fare_usd: 4 }));
  });
});
