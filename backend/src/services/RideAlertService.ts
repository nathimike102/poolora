/**
 * RideAlertService.ts
 *
 * Ride alerts (UC-R02 6a): when a search finds nothing, the rider can ask to
 * be told when a ride appears. Every new ride is checked against open
 * alerts; one whose route passes the rider's pickup and then their drop,
 * within the usual distance, at the right time, sends a push.
 */

import { Types } from 'mongoose';
import { User } from '../models/User';
import { RideAlert } from '../models/RideAlert';
import { IRide, rideRoutePath } from '../models/Ride';
import { config } from '../config';
import { AppError, NotFoundError } from '../utils/AppError';
import { toGeoPoint } from '../utils/helpers';
import { nearestOnPath } from '../utils/routeGeometry';
import { logger } from '../utils/logger';
import { isVerifiedWoman } from './IdentityService';
import { NotificationService } from './NotificationService';
import { money } from '../config/region';
import { localTime } from '../config/region';
import { phrase } from '../i18n';

const HOUR = 3_600_000;
const EARTH_RADIUS_KM = 6378.1;
const MAX_ALERTS_PER_RIDER = 10;
/** A ride matches if it leaves within this long of the time the rider wanted */
const TIME_WINDOW_MS = 3 * HOUR;

type Stop = { lat: number; lng: number; address: string };

export class RideAlertService {
  async create(riderId: string, data: { pickup: Stop; dropoff: Stop; departureTime?: string }) {
    const open = await RideAlert.countDocuments({ rider: riderId, expiresAt: { $gt: new Date() } });
    if (open >= MAX_ALERTS_PER_RIDER) {
      throw new AppError(`You can have up to ${MAX_ALERTS_PER_RIDER} ride alerts. Remove one first.`, 409, 'TOO_MANY_ALERTS');
    }
    const when = data.departureTime ? new Date(data.departureTime) : undefined;
    if (when && Number.isNaN(when.getTime())) throw new AppError('Invalid departure time', 422, 'VALIDATION_ERROR');
    const expiresAt = when ? new Date(when.getTime() + TIME_WINDOW_MS) : new Date(Date.now() + 30 * 24 * HOUR);
    if (expiresAt.getTime() <= Date.now()) throw new AppError('That time has already passed', 422, 'VALIDATION_ERROR');
    return RideAlert.create({
      rider: riderId,
      pickup: { location: toGeoPoint(data.pickup.lng, data.pickup.lat), address: data.pickup.address },
      dropoff: { location: toGeoPoint(data.dropoff.lng, data.dropoff.lat), address: data.dropoff.address },
      departureTime: when,
      expiresAt,
    });
  }

  async mine(riderId: string) {
    return RideAlert.find({ rider: riderId, expiresAt: { $gt: new Date() } }).select('-notifiedRides').sort({ createdAt: -1 }).lean();
  }

  async remove(riderId: string, alertId: string) {
    const deleted = await RideAlert.findOneAndDelete({ _id: alertId, rider: riderId });
    if (!deleted) throw new NotFoundError('Ride alert');
  }

  /** Checks a newly posted ride against open alerts and pushes each match once. */
  async notifyMatches(ride: IRide): Promise<number> {
    const path = rideRoutePath(ride);
    if (path.length < 2) return 0;
    const maxKm = config.ride.maxPickupDistanceFromRouteKm;
    const [startLng, startLat] = ride.pickup.location.coordinates;
    // Candidates: pickups anywhere within reach of the route, measured from its start
    const reachKm = (ride.estimatedDistanceKm || 50) + maxKm;
    const candidates = await RideAlert.find({
      rider: { $ne: ride.driver },
      expiresAt: { $gt: new Date() },
      notifiedRides: { $ne: ride._id },
      'pickup.location': { $geoWithin: { $centerSphere: [[startLng, startLat], reachKm / EARTH_RADIUS_KM] } },
    }).limit(500);

    const notifications = new NotificationService();
    let sent = 0;
    for (const alert of candidates) {
      if (alert.departureTime && Math.abs(alert.departureTime.getTime() - ride.departureTime.getTime()) > TIME_WINDOW_MS) continue;
      // A women-only ride is news only to a verified woman, as in search
      if (ride.preferences?.womenOnly && !isVerifiedWoman(await User.findById(alert.rider).select('gender identity').lean())) continue;
      const [pl, pa] = alert.pickup.location.coordinates;
      const [dl, da] = alert.dropoff.location.coordinates;
      const board = nearestOnPath({ lat: pa, lng: pl }, path);
      const leave = nearestOnPath({ lat: da, lng: dl }, path);
      if (board.distanceKm > maxKm || leave.distanceKm > maxKm || leave.alongKm <= board.alongKm) continue;

      await RideAlert.updateOne({ _id: alert._id }, { $addToSet: { notifiedRides: new Types.ObjectId(ride._id.toString()) } });
      const when = localTime(ride.departureTime, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      const title = phrase('rideAlert.title');
      const body = phrase('rideAlert.body', { from: alert.pickup.address.split(',')[0], to: alert.dropoff.address.split(',')[0], when, price: money(ride.pricePerSeat) });
      await notifications.sendPushNotification(alert.rider.toString(), title, body, { rideId: ride._id.toString(), type: 'ride_alert' }).catch(() => undefined);
      await notifications.createNotification(alert.rider.toString(), title, body, 'ride', { rideId: ride._id.toString() }).catch(() => undefined);
      sent++;
    }
    if (sent) logger.info('Ride alerts sent', { rideId: ride._id, sent });
    return sent;
  }
}
