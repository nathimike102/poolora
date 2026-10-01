/**
 * TripTrailService.ts
 *
 * Every phone on a ride, while it is under way (decided 30 September 2026):
 * the car (the driver's phone) and each rider from pickup to drop. The apps
 * send their position from a background task, so it keeps coming with the
 * screen off or another app (Maps) in front.
 *
 * - The car's position also reaches its riders' live maps, as before.
 * - About one point every 15 seconds per phone is stored (TripPosition) for
 *   30 days, or for good once an incident is attached to the ride.
 * - While an SOS is open on the ride, every phone's position goes to the
 *   admins' live map: whoever raised it, the others are traced too. A driver
 *   robbed by riders is covered as much as a rider.
 */

import { Types } from 'mongoose';
import { Booking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { TripPosition, TRIP_TRAIL_DAYS } from '../models/TripPosition';
import { BookingStatus, RideStatus, SOSStatus } from '../types';
import { AuthorizationError, NotFoundError } from '../utils/AppError';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

const STORE_EVERY_MS = 15_000;
const DAY = 86_400_000;
const OPEN = [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED];

export type TrailPoint = { lng: number; lat: number };
type Extra = { speed?: number; heading?: number; accuracy?: number; battery?: number };

/** One trail per person and source: the car's tracker is apart from the driver's phone */
export const trailId = (userId: string, role: string) => (role === 'vehicle' ? `${userId}:vehicle` : userId);

/** One stored point per phone per 15 s, across backend instances when Redis is there */
const lastStored = new Map<string, number>();
async function dueToStore(key: string, now: number): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    const ok = await redis.set(`trail:${key}`, '1', 'PX', STORE_EVERY_MS - 1_000, 'NX').catch(() => null);
    if (ok !== null) return ok === 'OK';
  }
  if (now - (lastStored.get(key) ?? 0) < STORE_EVERY_MS - 1_000) return false;
  lastStored.set(key, now);
  if (lastStored.size > 10_000) lastStored.clear();
  return true;
}

/**
 * Keeps a ride's trail past the 30 days: called when an SOS, a safety
 * report or a dispute is attached to it.
 */
export async function keepTripTrail(rideId: string | Types.ObjectId): Promise<void> {
  try {
    await Promise.all([
      Ride.updateOne({ _id: rideId }, { $set: { keepTrail: true } }),
      TripPosition.updateMany({ ride: rideId }, { $unset: { expiresAt: 1 } }),
    ]);
  } catch (error) {
    logger.error('Could not keep the trip trail', { rideId: String(rideId), error: (error as Error).message });
  }
}

/** Stores a point (if 15 s have passed for this phone) and relays it to any open SOS on the ride. */
export async function recordTripPosition(input: {
  rideId: string;
  bookingId?: string;
  userId: string;
  role: 'driver' | 'rider' | 'vehicle';
  location: TrailPoint;
  extra?: Extra;
}): Promise<void> {
  const now = Date.now();
  const { rideId, userId, role, location, extra = {} } = input;
  try {
    if (!(await dueToStore(`${rideId}:${userId}:${role}`, now))) return;
    const ride = await Ride.findById(rideId).select('keepTrail').lean();
    await TripPosition.create({
      ride: rideId,
      booking: input.bookingId,
      user: userId,
      role,
      location: { type: 'Point', coordinates: [location.lng, location.lat] },
      at: new Date(now),
      battery: typeof extra.battery === 'number' && extra.battery >= 0 && extra.battery <= 1 ? extra.battery : undefined,
      speed: extra.speed,
      accuracy: extra.accuracy,
      expiresAt: ride?.keepTrail ? undefined : new Date(now + TRIP_TRAIL_DAYS * DAY),
    });

    // To the admins' live map, for every SOS open on this ride (every 15 s per phone)
    const open = await EmergencyRecord.find({ ride: rideId, status: { $in: OPEN } }).select('_id').lean();
    if (open.length) {
      const { SocketGateway } = await import('../sockets/SocketGateway');
      const io = SocketGateway.getInstance()?.getIO();
      for (const sos of open) {
        io?.to('admin:sos').emit('sos:alert', {
          eventType: 'sos.trail',
          data: { emergencyId: String(sos._id), userId, role, trailId: trailId(userId, role), location, battery: extra.battery, at: now },
        });
      }
    }
  } catch (error) {
    logger.warn('Trip position not recorded', { rideId, error: (error as Error).message });
  }
}

/**
 * A position from a phone on a ride (POST /rides/:id/position), sent by the
 * app's background task. The driver's is the car's: it goes to each rider's
 * live map as before. A rider's counts from pickup to drop. Returns whether
 * the phone should keep sending, so the task stops itself after the ride.
 */
export async function receiveTripPosition(
  rideId: string,
  userId: string,
  location: TrailPoint,
  extra: Extra = {},
): Promise<{ tracking: boolean }> {
  const ride = await Ride.findById(rideId).select('driver status').lean();
  if (!ride) throw new NotFoundError('Ride');
  if (ride.status !== RideStatus.IN_PROGRESS) return { tracking: false };

  if (String(ride.driver) === userId) {
    // Stored first, with the battery level; the relay below then finds this phone already stored
    await recordTripPosition({ rideId, userId, role: 'driver', location, extra });
    const bookings = await Booking.find({ ride: rideId, status: BookingStatus.CONFIRMED }).select('_id').lean();
    const { SocketGateway } = await import('../sockets/SocketGateway');
    const gateway = SocketGateway.getInstance();
    for (const b of bookings) {
      await gateway?.handleDriverLocationUpdate(userId, {
        bookingId: String(b._id),
        location,
        speed: extra.speed,
        heading: extra.heading,
        accuracy: extra.accuracy,
        timestamp: Date.now(),
      }).catch((error: Error) => logger.debug('Car position not relayed', { bookingId: String(b._id), error: error.message }));
    }
    return { tracking: true };
  }

  const booking = await Booking.findOne({ ride: rideId, rider: userId, status: BookingStatus.CONFIRMED })
    .select('_id actualPickupTime actualDropoffTime')
    .lean();
  if (!booking) {
    const ever = await Booking.exists({ ride: rideId, rider: userId });
    if (!ever) throw new AuthorizationError('You are not on this ride');
    return { tracking: false };
  }
  if (booking.actualDropoffTime) return { tracking: false };
  // Before pickup the rider is not in the car yet; keep the task running, store nothing
  if (!booking.actualPickupTime) return { tracking: true };
  await recordTripPosition({ rideId, bookingId: String(booking._id), userId, role: 'rider', location, extra });
  return { tracking: true };
}

/** Each phone's trail on a ride between two times, for the admins' incident page. */
export async function rideTrails(rideId: string | Types.ObjectId, from: Date, to?: Date) {
  const points = await TripPosition.find({ ride: rideId, at: to ? { $gte: from, $lte: to } : { $gte: from } })
    .select('user role location at battery')
    .sort({ at: 1 })
    .limit(20_000)
    .lean();
  const byUser = new Map<string, { id: string; userId: string; role: 'driver' | 'rider' | 'vehicle'; points: Array<{ lng: number; lat: number; at: Date; battery?: number }> }>();
  for (const p of points) {
    const key = trailId(String(p.user), p.role);
    if (!byUser.has(key)) byUser.set(key, { id: key, userId: String(p.user), role: p.role, points: [] });
    byUser.get(key)!.points.push({ lng: p.location.coordinates[0], lat: p.location.coordinates[1], at: p.at, battery: p.battery });
  }
  return [...byUser.values()];
}

/** The car's latest stored position on a ride, when the live one has gone. */
export async function lastCarPosition(rideId: string | Types.ObjectId): Promise<{ lng: number; lat: number; at: Date } | null> {
  // The driver's phone or the car's own tracker, whichever was heard last
  const last = await TripPosition.findOne({ ride: rideId, role: { $in: ['driver', 'vehicle'] } }).sort({ at: -1 }).select('location at').lean();
  return last ? { lng: last.location.coordinates[0], lat: last.location.coordinates[1], at: last.at } : null;
}
