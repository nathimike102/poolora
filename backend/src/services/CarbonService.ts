/**
 * CarbonService.ts
 *
 * CO₂ saved by shared seats (UC-R11). A completed booking saves the trip its
 * rider would otherwise have made alone in an average car; the rider's share
 * of the shared car is taken off that. The method, and why each choice errs
 * low, is in docs/planning/12-NEXT-PHASES.md §1.
 */

import { Types } from 'mongoose';
import { config } from '../config';
import { REGION, fromLocalClock, toLocalClock } from '../config/region';
import { Booking, IBooking } from '../models/Booking';
import { IRide, Ride, rideRoutePath } from '../models/Ride';
import { BookingStatus } from '../types';
import { haversineDistanceKm } from '../utils/helpers';
import { nearestOnPath } from '../utils/routeGeometry';

type Point = { location: { coordinates: number[] } };

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** kg CO₂ per km for a vehicle class; an unknown class counts as an average car */
export function kgPerKm(vehicleType: string): number {
  return config.carbon.kgPerKm[vehicleType] ?? config.carbon.baselineKgPerKm;
}

/**
 * kg CO₂ one booking saved. One car per booking is the baseline, however
 * many seats it holds, and the result is never below zero.
 */
export function co2SavedKg(input: { legKm: number; vehicleType: string; seats: number; onBoard: number }): number {
  const { legKm, vehicleType, seats, onBoard } = input;
  if (!(legKm > 0) || !(seats > 0)) return 0;
  const people = Math.max(onBoard, seats + 1);
  const alone = legKm * config.carbon.baselineKgPerKm;
  const share = (legKm * kgPerKm(vehicleType) * seats) / people;
  return round(Math.max(0, alone - share), 2);
}

/**
 * The rider's leg in km: along the ride's route from their pickup to their
 * drop, or the straight line between them when the route cannot give one.
 */
export function legDistanceKm(ride: Parameters<typeof rideRoutePath>[0], pickup: Point, dropoff: Point): number {
  const toLatLng = (p: Point) => ({ lat: p.location.coordinates[1], lng: p.location.coordinates[0] });
  const from = toLatLng(pickup);
  const to = toLatLng(dropoff);
  const straight = haversineDistanceKm(from.lat, from.lng, to.lat, to.lng);
  const path = rideRoutePath(ride);
  if (path.length >= 2) {
    const along = nearestOnPath(to, path).alongKm - nearestOnPath(from, path).alongKm;
    // Along the route is never shorter than the straight line between the points
    if (along >= straight) return round(along, 1);
  }
  return round(straight, 1);
}

export interface ImpactTotals {
  co2SavedKg: number;
  kmShared: number;
  trips: number;
}

export interface Impact {
  allTime: ImpactTotals;
  thisMonth: ImpactTotals;
  /** The last six months, oldest first, as YYYY-MM in market time */
  months: Array<ImpactTotals & { month: string }>;
  method: { baselineKgPerKm: number; kgPerKm: Record<string, number> };
}

const EMPTY: ImpactTotals = { co2SavedKg: 0, kmShared: 0, trips: 0 };

export class CarbonService {
  /** Distance and saving for a booking about to complete */
  async measureBooking(booking: Pick<IBooking, 'ride' | 'pickup' | 'dropoff' | 'seatsBooked'>): Promise<{ distanceKm: number; co2SavedKg: number }> {
    const ride = await Ride.findById(booking.ride).select('routePolyline pickup dropoff waypoints vehicle.vehicleType').lean<IRide>();
    if (!ride) return { distanceKm: 0, co2SavedKg: 0 };
    const [seated] = await Booking.aggregate<{ seats: number }>([
      { $match: { ride: new Types.ObjectId(String(booking.ride)), status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } } },
      { $group: { _id: null, seats: { $sum: '$seatsBooked' } } },
    ]);
    const distanceKm = legDistanceKm(ride, booking.pickup, booking.dropoff);
    return {
      distanceKm,
      co2SavedKg: co2SavedKg({
        legKm: distanceKm,
        vehicleType: ride.vehicle?.vehicleType,
        seats: booking.seatsBooked,
        onBoard: 1 + (seated?.seats ?? 0),
      }),
    };
  }

  /** What a user's shared trips saved, as rider and as driver */
  async impact(userId: string): Promise<Impact> {
    const id = new Types.ObjectId(userId);
    const local = toLocalClock(new Date());
    const firstOfMonth = (monthsBack: number) =>
      fromLocalClock(new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsBack, 1)));
    const since = firstOfMonth(5);

    const [result] = await Booking.aggregate<{ allTime: ImpactTotals[]; months: Array<ImpactTotals & { _id: string }> }>([
      { $match: { status: BookingStatus.COMPLETED, $or: [{ rider: id }, { driver: id }], co2SavedKg: { $exists: true } } },
      { $addFields: { at: { $ifNull: ['$actualDropoffTime', '$updatedAt'] } } },
      {
        $facet: {
          allTime: [{ $group: { _id: null, co2SavedKg: { $sum: '$co2SavedKg' }, kmShared: { $sum: '$distanceKm' }, trips: { $sum: 1 } } }],
          months: [
            { $match: { at: { $gte: since } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$at', timezone: REGION.timeZone } },
                co2SavedKg: { $sum: '$co2SavedKg' },
                kmShared: { $sum: '$distanceKm' },
                trips: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const tidy = (t?: ImpactTotals): ImpactTotals =>
      t ? { co2SavedKg: round(t.co2SavedKg, 1), kmShared: round(t.kmShared, 1), trips: t.trips } : { ...EMPTY };
    const byMonth = new Map((result?.months ?? []).map((m) => [m._id, m]));
    const months = Array.from({ length: 6 }, (_, i) => {
      const month = toLocalClock(firstOfMonth(5 - i)).toISOString().slice(0, 7);
      return { month, ...tidy(byMonth.get(month)) };
    });

    return {
      allTime: tidy(result?.allTime[0]),
      thisMonth: months[months.length - 1],
      months,
      method: { baselineKgPerKm: config.carbon.baselineKgPerKm, kgPerKm: { ...config.carbon.kgPerKm } },
    };
  }

  /** Everything every completed booking has saved, for admins */
  async platformTotal(): Promise<ImpactTotals> {
    const [t] = await Booking.aggregate<ImpactTotals>([
      { $match: { status: BookingStatus.COMPLETED, co2SavedKg: { $exists: true } } },
      { $group: { _id: null, co2SavedKg: { $sum: '$co2SavedKg' }, kmShared: { $sum: '$distanceKm' }, trips: { $sum: 1 } } },
    ]);
    return t ? { co2SavedKg: round(t.co2SavedKg, 1), kmShared: round(t.kmShared, 1), trips: t.trips } : { ...EMPTY };
  }

  /**
   * Measures bookings completed before carbon was counted, and adds them to
   * the users' totals. Safe to run again: only unmeasured bookings are taken.
   */
  async backfill(): Promise<{ measured: number }> {
    const { User } = await import('../models/User');
    let measured = 0;
    const cursor = Booking.find({ status: BookingStatus.COMPLETED, co2SavedKg: { $exists: false } })
      .select('ride rider driver pickup dropoff seatsBooked')
      .cursor();
    for await (const booking of cursor) {
      const { distanceKm, co2SavedKg: saved } = await this.measureBooking(booking);
      const claimed = await Booking.updateOne(
        { _id: booking._id, co2SavedKg: { $exists: false } },
        { $set: { distanceKm, co2SavedKg: saved } },
      );
      if (claimed.modifiedCount !== 1) continue;
      const inc = { $inc: { 'stats.co2SavedKg': saved, 'stats.kmShared': distanceKm } };
      await Promise.all([User.updateOne({ _id: booking.rider }, inc), User.updateOne({ _id: booking.driver }, inc)]);
      measured += 1;
    }
    return { measured };
  }
}
