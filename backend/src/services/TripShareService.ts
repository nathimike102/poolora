/**
 * TripShareService.ts
 *
 * Live trip sharing (UC-R08): a rider sends a link to people they trust,
 * who can follow the trip without an account. The link carries a random
 * token, shows only first names, the car and the latest position, stops
 * working an hour after the trip ends (or at once if it is cancelled), and
 * every visit is logged.
 */

import crypto from 'crypto';
import { Booking } from '../models/Booking';
import { Ride, rideRoutePath } from '../models/Ride';
import { User } from '../models/User';
import { TripShare } from '../models/TripShare';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { BookingStatus, RideStatus } from '../types';
import { AuthorizationError, ConflictError, NotFoundError } from '../utils/AppError';
import { nearestOnPath } from '../utils/routeGeometry';

const HOUR = 3_600_000;
/** City average used for the ETA when the car's speed is not known */
const AVERAGE_KMH = 30;

export interface PublicTrip {
  riderFirstName: string;
  driverFirstName: string;
  vehicle: string;
  from: string;
  to: string;
  departure: Date;
  status: 'waiting' | 'on_the_way' | 'in_car' | 'arrived';
  position?: { lat: number; lng: number; at: Date };
  etaMins?: number;
}

const firstName = (name?: string) => (name ?? '').trim().split(/\s+/)[0] || 'Someone';

export class TripShareService {
  /** Returns the share link for a booking, creating one if needed. Riders only. */
  async create(userId: string, bookingId: string): Promise<{ url: string; expiresAt: Date }> {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    if (booking.rider.toString() !== userId) throw new AuthorizationError('Only the rider can share this trip');
    if (booking.status !== BookingStatus.CONFIRMED) throw new ConflictError('Only a confirmed trip can be shared');
    const ride = await Ride.findById(booking.ride).select('departureTime estimatedArrivalTime').lean();
    if (!ride) throw new NotFoundError('Ride');

    // Valid until an hour after the planned arrival; extended while the trip runs late (see publicView)
    const expiresAt = new Date(Math.max(ride.estimatedArrivalTime.getTime(), ride.departureTime.getTime()) + HOUR);
    let share = await TripShare.findOne({ booking: booking._id, expiresAt: { $gt: new Date() } });
    if (!share) {
      share = await TripShare.create({
        token: crypto.randomBytes(24).toString('base64url'),
        booking: booking._id,
        createdBy: userId,
        expiresAt,
      });
    }
    return { url: `${config.app.baseUrl}/track/trip/${share.token}`, expiresAt: share.expiresAt };
  }

  /** What the public page shows, or null when the link is unknown or has expired. Logs the visit. */
  async publicView(token: string, ip?: string): Promise<PublicTrip | null> {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
    const share = await TripShare.findOne({ token });
    if (!share) return null;
    const booking = await Booking.findById(share.booking);
    if (!booking || booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.REJECTED) return null;
    const ride = await Ride.findById(booking.ride);
    if (!ride) return null;

    const now = Date.now();
    const ended = booking.actualDropoffTime ?? (ride.status === RideStatus.COMPLETED ? ride.completedAt : undefined);
    if (ended) {
      if (now > ended.getTime() + HOUR) return null;
    } else if (now > share.expiresAt.getTime()) {
      // Running late: keep the link alive while the ride is still under way
      if (ride.status !== RideStatus.IN_PROGRESS) return null;
    }

    await TripShare.updateOne({ _id: share._id }, { $push: { views: { $each: [{ at: new Date(), ip }], $slice: -200 } } });

    const [rider, driver] = await Promise.all([
      User.findById(booking.rider).select('name').lean(),
      User.findById(booking.driver).select('name vehicles').lean(),
    ]);
    const car = driver?.vehicles?.find((v) => String(v._id) === String(ride.vehicle.vehicleId));
    const vehicle = [car ? `${car.color} ${car.make} ${car.model}` : ride.vehicle.vehicleType, ride.vehicle.plateNumber].filter(Boolean).join(' · ');

    let status: PublicTrip['status'] = 'waiting';
    if (ended) status = 'arrived';
    else if (booking.actualPickupTime) status = 'in_car';
    else if (ride.status === RideStatus.IN_PROGRESS) status = 'on_the_way';

    const view: PublicTrip = {
      riderFirstName: firstName(rider?.name),
      driverFirstName: firstName(driver?.name),
      vehicle,
      from: booking.pickup.address,
      to: booking.dropoff.address,
      departure: ride.departureTime,
      status,
    };

    if (status === 'on_the_way' || status === 'in_car') {
      const redis = getRedisClient();
      const cached = redis ? await redis.get(`booking:${booking._id}:driver:location`).catch(() => null) : null;
      if (cached) {
        const p = JSON.parse(cached) as { lat: number; lng: number; speed?: number; timestamp?: number };
        view.position = { lat: p.lat, lng: p.lng, at: new Date(p.timestamp ?? now) };
        // Distance left along the route to where this rider gets off (or on, before pickup)
        const path = ride.routeLine?.coordinates?.length ? ride.routeLine.coordinates.map(([lng, lat]) => ({ lat, lng })) : rideRoutePath(ride);
        const target = status === 'in_car' ? booking.dropoff.location.coordinates : booking.pickup.location.coordinates;
        const car = nearestOnPath({ lat: p.lat, lng: p.lng }, path).alongKm;
        const end = nearestOnPath({ lat: target[1], lng: target[0] }, path).alongKm;
        const speed = p.speed && p.speed > 5 ? Math.min(p.speed, 80) : AVERAGE_KMH;
        view.etaMins = Math.max(1, Math.round((Math.max(0, end - car) / speed) * 60));
      }
    }
    return view;
  }
}
