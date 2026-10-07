/**
 * TrackerService.ts
 *
 * Car GPS trackers (decided 1 October 2026). A driver links the tracker in
 * their car by its device id (usually the IMEI). Trackers report to a
 * Traccar gateway run by Siham, which understands almost every tracker
 * protocol, stores nothing, and posts each position here (forward.type=json).
 * A tracking company that agrees to share can forward to the same gateway.
 *
 * Why: the car's own tracker keeps reporting when every phone in it is off.
 *
 * - Positions are kept only while the car is on a ride in progress, or an
 *   SOS on one of its rides is open. Otherwise only the time of the last
 *   report is kept (for the "Tracked car" badge), never where the car was.
 * - The tracker's panic button, pressed during a ride, raises an SOS like
 *   the app's (decided: raise an SOS).
 * - A cut or removed tracker during a ride alerts the safety team.
 * - Siham never cuts an engine (decided: never).
 */

import { Types } from 'mongoose';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { Booking } from '../models/Booking';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { BookingStatus, RideStatus, SOSStatus } from '../types';
import { AppError, NotFoundError } from '../utils/AppError';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { recordTripPosition } from './TripTrailService';
import { pageSafetyTeam } from './SafetyAlerts';

/** Most trackers identify by IMEI (15 digits); some by a shorter serial */
const DEVICE_ID = /^[0-9A-Za-z]{6,20}$/;
/** A tracker that reported this recently earns the "Tracked car" badge */
export const TRACKED_WITHIN_MS = 24 * 3_600_000;
const LAST_REPORT_EVERY_MS = 60_000;
/** Trackers repeat an alarm; one press, or one power cut, counts once per ride in this time */
const ALARM_REPEAT_MS = 5 * 60_000;
const KNOTS_TO_KMH = 1.852;
const OPEN = [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED];
const TAMPER_ALARMS = ['powerCut', 'removing', 'tampering'];

/** What Traccar posts with forward.type=json (PositionData: position and device) */
export interface TraccarPayload {
  position?: {
    latitude?: number;
    longitude?: number;
    fixTime?: string;
    /** knots */
    speed?: number;
    course?: number;
    accuracy?: number;
    valid?: boolean;
    attributes?: Record<string, unknown>;
  };
  device?: { uniqueId?: string; name?: string };
}

/** Whether a tracker counts as working for the badge */
export function isTracked(tracker?: { lastReportAt?: Date | string }, now = Date.now()): boolean {
  return Boolean(tracker?.lastReportAt && now - new Date(tracker.lastReportAt).getTime() < TRACKED_WITHIN_MS);
}

/** True the first time a key is seen within `ms` (across instances with Redis) */
const seen = new Map<string, number>();
async function firstWithin(key: string, ms: number): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    const ok = await redis.set(`tracker:${key}`, '1', 'PX', ms, 'NX').catch(() => null);
    if (ok !== null) return ok === 'OK';
  }
  const now = Date.now();
  if (now - (seen.get(key) ?? 0) < ms) return false;
  seen.set(key, now);
  if (seen.size > 10_000) seen.clear();
  return true;
}

export class TrackerService {
  // ─── Drivers ───────────────────────────────────────────────────────────────

  /** The driver's cars and their trackers, with where to point a tracker. */
  async status(userId: string) {
    const user = await User.findById(userId).select('vehicles').lean();
    if (!user) throw new NotFoundError('User');
    return {
      gateway: config.trackers.gatewayHost ? { host: config.trackers.gatewayHost, port: config.trackers.gatewayPort, protocol: 'GT06' } : null,
      vehicles: (user.vehicles ?? []).map((v) => ({
        _id: String(v._id),
        name: `${v.color} ${v.make} ${v.model}`,
        plateNumber: v.plateNumber,
        tracker: v.tracker
          ? { deviceId: v.tracker.deviceId, linkedAt: v.tracker.linkedAt, lastReportAt: v.tracker.lastReportAt ?? null, tracked: isTracked(v.tracker) }
          : null,
      })),
    };
  }

  async link(userId: string, vehicleId: string, deviceId: unknown) {
    const id = typeof deviceId === 'string' ? deviceId.replace(/\s+/g, '') : '';
    if (!DEVICE_ID.test(id)) throw new AppError('Enter the tracker\'s device id: usually its 15-digit IMEI, on a sticker on the device', 422, 'VALIDATION_ERROR');
    try {
      const result = await User.updateOne(
        { _id: userId, 'vehicles._id': new Types.ObjectId(vehicleId) },
        { $set: { 'vehicles.$.tracker': { deviceId: id, linkedAt: new Date() } } },
      );
      if (!result.matchedCount) throw new NotFoundError('Vehicle');
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new AppError('This tracker is already linked to another car. If it is yours, contact support.', 409, 'TRACKER_IN_USE');
      }
      throw error;
    }
    return this.status(userId);
  }

  async unlink(userId: string, vehicleId: string) {
    const result = await User.updateOne(
      { _id: userId, 'vehicles._id': new Types.ObjectId(vehicleId) },
      { $unset: { 'vehicles.$.tracker': 1 } },
    );
    if (!result.matchedCount) throw new NotFoundError('Vehicle');
    return this.status(userId);
  }

  // ─── The gateway ───────────────────────────────────────────────────────────

  /**
   * One position from the Traccar gateway. Always answered quickly: Traccar
   * retries anything else. Returns what happened, for logs and tests.
   */
  async receive(payload: TraccarPayload): Promise<'unknown' | 'ignored' | 'stored'> {
    const deviceId = String(payload.device?.uniqueId ?? '').trim();
    if (!DEVICE_ID.test(deviceId)) return 'unknown';
    const owner = await User.findOne({ 'vehicles.tracker.deviceId': deviceId }).select('name vehicles').lean();
    const vehicle = owner?.vehicles?.find((v) => v.tracker?.deviceId === deviceId);
    if (!owner || !vehicle?._id) return 'unknown';

    const now = new Date();
    const last = vehicle.tracker?.lastReportAt ? new Date(vehicle.tracker.lastReportAt).getTime() : 0;
    if (now.getTime() - last > LAST_REPORT_EVERY_MS) {
      await User.updateOne({ _id: owner._id, 'vehicles._id': vehicle._id }, { $set: { 'vehicles.$.tracker.lastReportAt': now } });
    }

    const rideId = await this.rideToTrace(owner._id, vehicle._id);
    if (!rideId) return 'ignored'; // not on a ride: where the car is stays private

    const p = payload.position ?? {};
    const attributes = p.attributes ?? {};
    const alarms = String(attributes.alarm ?? '').split(',').map((a) => a.trim()).filter(Boolean);
    const plate = vehicle.plateNumber;

    const hasFix = p.valid !== false && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
      && Math.abs(p.latitude!) <= 90 && Math.abs(p.longitude!) <= 180;
    const location = hasFix ? { lat: p.latitude!, lng: p.longitude! } : null;
    if (location) {
      const battery = typeof attributes.batteryLevel === 'number' ? Math.max(0, Math.min(1, attributes.batteryLevel / 100)) : undefined;
      await recordTripPosition({
        rideId: rideId.ride,
        userId: String(owner._id),
        role: 'vehicle',
        location,
        extra: { speed: typeof p.speed === 'number' ? p.speed * KNOTS_TO_KMH : undefined, accuracy: p.accuracy, battery },
      });
    }

    if (alarms.includes('sos') && rideId.inProgress && (await firstWithin(`${deviceId}:${rideId.ride}:sos`, ALARM_REPEAT_MS))) {
      await this.panic(rideId.ride, String(owner._id), plate, location);
    }
    const tamper = alarms.find((a) => TAMPER_ALARMS.includes(a));
    if (tamper && (await firstWithin(`${deviceId}:${rideId.ride}:${tamper}`, ALARM_REPEAT_MS))) {
      await this.tampered(rideId.ride, plate, tamper);
    }
    return location ? 'stored' : 'ignored';
  }

  /** The ride this car is on now, or one of its rides with an SOS still open. */
  private async rideToTrace(ownerId: Types.ObjectId, vehicleId: Types.ObjectId): Promise<{ ride: string; inProgress: boolean } | null> {
    const live = await Ride.findOne({ driver: ownerId, 'vehicle.vehicleId': vehicleId, status: RideStatus.IN_PROGRESS }).select('_id').lean();
    if (live) return { ride: String(live._id), inProgress: true };
    const open = await EmergencyRecord.find({ status: { $in: OPEN } }).select('ride').lean();
    if (!open.length) return null;
    const ride = await Ride.findOne({ _id: { $in: open.map((o) => o.ride) }, 'vehicle.vehicleId': vehicleId }).select('_id').lean();
    return ride ? { ride: String(ride._id), inProgress: false } : null;
  }

  /**
   * The panic button in the car was pressed during a ride: an SOS, as if from
   * the app. It is the driver's SOS (their contacts are texted), on the booking
   * of a rider in the car, since anyone in the car may have pressed it.
   */
  private async panic(rideId: string, driverId: string, plate: string, location: { lat: number; lng: number } | null) {
    const bookings = await Booking.find({ ride: rideId, status: BookingStatus.CONFIRMED }).select('_id actualPickupTime actualDropoffTime').lean();
    const inCar = bookings.find((b) => b.actualPickupTime && !b.actualDropoffTime) ?? bookings[0];
    if (!inCar) {
      await pageSafetyTeam('', `The panic button in car ${plate} was pressed during a ride with nobody booked. Call the driver`);
      return;
    }
    const { SafetyService } = await import('./SafetyService');
    await new SafetyService().triggerSOS(driverId, {
      bookingId: String(inCar._id),
      location: location ?? undefined,
      via: 'tracker',
      reason: `The panic button in car ${plate} was pressed. It may have been the driver or a rider`,
    }).catch((error: Error) => logger.error('Panic button SOS not raised', { rideId, error: error.message }));
  }

  /** The tracker lost power or was removed during a ride, or while an SOS is open. */
  private async tampered(rideId: string, plate: string, alarm: string) {
    const what = alarm === 'powerCut' ? 'lost power' : 'was removed or tampered with';
    const sos = await EmergencyRecord.findOne({ ride: rideId, status: { $in: OPEN } });
    if (sos) {
      sos.timeline.push({ event: 'Car tracker alarm', timestamp: new Date(), details: `The tracker in ${plate} ${what}` });
      await sos.save();
      await pageSafetyTeam(String(sos._id), `During an open SOS, the tracker in car ${plate} ${what}`);
      return;
    }
    await pageSafetyTeam('', `The tracker in car ${plate} ${what} during a ride. It may be the driver unplugging it; check the ride`, { sms: false });
  }
}
