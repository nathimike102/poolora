import { Types, type FilterQuery, type PipelineStage } from 'mongoose';
import { Ride, IRide } from '../models/Ride';
import type { Document } from 'mongoose';
import { User } from '../models/User';
import { Booking, type IBooking } from '../models/Booking';
import { config } from '../config';
import {
  RideStatus,
  RideSearchParams,
  MatchScore,
  BookingStatus,
  KYCStatus,
  MAX_SEATS_BY_VEHICLE,
} from '../types';
import {
  AppError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
} from '../utils/AppError';
import { toGeoPoint, paginate } from '../utils/helpers';
import { mlClient } from '../utils/mlClient';
import { nearestOnPath } from '../utils/routeGeometry';
import { PricingService } from './PricingService';
import { verifiedDriverStatus } from './DriverService';
import { MatchingEngineClient } from './MatchingEngineClient';
import { getRoute } from './MapsService';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { isVerifiedWoman, womenOnlyRefusal } from './IdentityService';
import { isTracked } from './TrackerService';
import { money } from '../config/region';
import { activeOrganisationOf, colleaguesOf } from './OrganisationService';

/**
 * A search hit as it goes out over the API: a plain object from the
 * aggregation, not a Mongoose document, with the driver reduced to the public
 * fields and the match score attached.
 */
export type SearchResultRide = Omit<RidePlainObject, 'driver'> & {
  driver: {
    _id: string;
    name: string;
    profilePhotoUrl?: string;
    stats: { avgRatingAsDriver: number; totalRatingsAsDriver: number; totalRidesAsDriver: number };
  };
  matchScore?: number;
};

/** The ride's own fields, without the Mongoose document machinery. */
type RidePlainObject = Omit<IRide, keyof Document>;


/** What the ML service returns for a multi-stop route, or our fallback order. */
export interface OptimizedRouteResult {
  optimizedOrder: string[];
  totalDistanceKm: number;
  segments: Array<{ from: string; to: string; distanceKm: number; durationMins: number }>;
  /** Set when the ML service was unreachable and the naive order is returned. */
  fallback?: boolean;
}

/** A booking with its ride, and that ride's driver, already populated. */
type PopulatedRideBooking = Omit<IBooking, 'ride'> & {
  ride:
    | (Pick<IRide, 'pickup' | 'dropoff' | 'departureTime' | 'pricePerSeat'> & {
        _id: Types.ObjectId;
        driver?: { name?: string; phone?: string; profilePhotoUrl?: string } | null;
      })
    | null;
};

/** Mean Earth radius, to turn a distance into radians for $centerSphere. */
const EARTH_RADIUS_METERS = 6_378_100;

/** Most rides a search considers before direction, rating and paging filters. */
const SEARCH_CANDIDATE_LIMIT = 200;

/** A circle as a GeoJSON polygon (32 sides), for $geoIntersects. */
function circlePolygon(lng: number, lat: number, radiusMeters: number) {
  const sides = 32;
  const dLat = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  const ring: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return { type: 'Polygon' as const, coordinates: [ring] };
}

/** Search results carry the encoded polyline; the GeoJSON copy only bloats them. */
function withoutRouteLine<T extends { routeLine?: unknown }>(ride: T): Omit<T, 'routeLine'> {
  const copy = { ...ride };
  delete (copy as { routeLine?: unknown }).routeLine;
  return copy;
}

/** Ride creation rules (UC-D02) */
const MIN_ADVANCE_HOURS = 2;
/** Long enough for the intercity corridors: Harare to Beitbridge is about 580 km */
const MAX_RIDE_KM = 650;
const MAX_STOPS = 3;

export class RideService {
  private matchingEngine = new MatchingEngineClient();

  /**
   * Create a new ride. Requires driverVerified === true.
   * Max 5 active future rides per driver.
   */
  async createRide(
    driverId: string,
    data: {
      rideType: string;
      vehicleId: string;
      pickup: { lng: number; lat: number; address: string };
      dropoff: { lng: number; lat: number; address: string };
      departureTime: string;
      totalSeats: number;
      pricePerSeat: number;
      recurring: string;
      preferences: IRide['preferences'];
      parcelInfo?: IRide['parcelInfo'];
      /** Stops on the way, in order (UC-D02 step 9) */
      waypoints?: Array<{ lng: number; lat: number; address: string }>;
    },
    /** The ride simulator posts rides that leave in minutes, at a fixed price */
    options: { skipCreationRules?: boolean } = {},
  ): Promise<IRide> {
    // Verify driver exists and is approved
    const driver = await User.findById(driverId);
    if (!driver) throw new NotFoundError('User');
    if (driver.kyc.status !== KYCStatus.APPROVED) {
      throw new AuthorizationError('Driver KYC not approved');
    }
    // A women-only ride is only as safe as its driver: she must be a verified woman
    if (data.preferences?.womenOnly && !isVerifiedWoman(driver)) {
      throw new AppError('Only women who have verified their identity can post women-only rides. Verify it in Profile > Identity check.', 403, 'IDENTITY_NOT_VERIFIED');
    }
    // A colleagues-only ride belongs to the driver's company while its programme is active (UC-C02)
    const company = data.preferences?.colleaguesOnly ? await activeOrganisationOf(driverId) : null;
    if (data.preferences?.colleaguesOnly && !company) {
      throw new AppError('Only staff of a company on Poolora can post colleagues-only rides. Join from Profile > Work.', 403, 'NOT_A_COMPANY_MEMBER');
    }

    // Check max active rides
    const activeRideCount = await Ride.countDocuments({
      driver: driverId,
      status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE] },
    });

    if (activeRideCount >= config.ride.maxActivePerDriver) {
      throw new AppError(
        `Maximum of ${config.ride.maxActivePerDriver} active rides allowed`,
        400,
        'MAX_RIDES_REACHED',
      );
    }

    // Validate vehicle belongs to driver
    const vehicle = driver.vehicles.find(
      (v) => v._id?.toString() === data.vehicleId,
    );
    if (!vehicle) {
      throw new NotFoundError('Vehicle');
    }

    const seatLimit = MAX_SEATS_BY_VEHICLE[vehicle.vehicleType] ?? 8;
    if (data.totalSeats > seatLimit) {
      throw new AppError(`This vehicle can offer at most ${seatLimit} seat${seatLimit === 1 ? '' : 's'}.`, 422, 'TOO_MANY_SEATS');
    }

    // Road route from OSRM (OpenStreetMap)
    const departureTime = new Date(data.departureTime);
    const stops = (data.waypoints ?? []).slice(0, MAX_STOPS);
    // Rides are posted at least 2 hours ahead (UC-D02), so riders can plan
    if (!options.skipCreationRules && departureTime.getTime() < Date.now() + MIN_ADVANCE_HOURS * 3_600_000) {
      throw new AppError(`Post rides at least ${MIN_ADVANCE_HOURS} hours before they leave, so riders have time to book.`, 422, 'TOO_SOON');
    }

    let estimatedDistanceKm: number;
    let estimatedDurationMins: number;
    let routePolyline: string;

    try {
      const routeData = await getRoute(
        { lat: data.pickup.lat, lng: data.pickup.lng },
        { lat: data.dropoff.lat, lng: data.dropoff.lng },
        stops,
      );
      estimatedDistanceKm = routeData.distanceKm;
      estimatedDurationMins = routeData.durationMins;
      routePolyline = routeData.polyline;
    } catch (error) {
      // Straight-line estimate when the routing service is unavailable
      logger.warn('Routing unavailable, using haversine fallback', {
        error: (error as Error).message,
      });
      const { haversineDistanceKm } = await import('../utils/helpers');
      estimatedDistanceKm = Math.round(
        haversineDistanceKm(data.pickup.lat, data.pickup.lng, data.dropoff.lat, data.dropoff.lng) * 100,
      ) / 100;
      estimatedDurationMins = Math.round((estimatedDistanceKm / 30) * 60); // ~30 km/h avg
      routePolyline = '';
    }

    if (estimatedDistanceKm > MAX_RIDE_KM) {
      throw new AppError(`Rides can be at most ${MAX_RIDE_KM} km, for safety. This route is ${Math.round(estimatedDistanceKm)} km.`, 422, 'RIDE_TOO_LONG');
    }
    // The price must stay within US$0.02 to US$0.20 a km and ±30% of the suggestion (UC-D02)
    if (!options.skipCreationRules) {
      const pricing = new PricingService();
      const suggestion = await pricing.suggest({
        distanceKm: estimatedDistanceKm,
        vehicleType: vehicle.vehicleType,
        departureTime,
        pickup: { lat: data.pickup.lat, lng: data.pickup.lng },
      });
      pricing.check(data.pricePerSeat, suggestion);
    }

    const estimatedArrivalTime = new Date(
      departureTime.getTime() + estimatedDurationMins * 60 * 1000,
    );

    const ride = await Ride.create({
      driver: driverId,
      rideType: data.rideType,
      status: RideStatus.SCHEDULED,
      vehicle: {
        vehicleId: vehicle._id,
        vehicleType: vehicle.vehicleType,
        hasAC: vehicle.hasAC,
        plateNumber: vehicle.plateNumber,
      },
      pickup: {
        location: toGeoPoint(data.pickup.lng, data.pickup.lat),
        address: data.pickup.address,
      },
      dropoff: {
        location: toGeoPoint(data.dropoff.lng, data.dropoff.lat),
        address: data.dropoff.address,
      },
      waypoints: stops.map((p, order) => ({ location: toGeoPoint(p.lng, p.lat), address: p.address, order })),
      departureTime,
      estimatedArrivalTime,
      estimatedDurationMins,
      estimatedDistanceKm,
      routePolyline,
      pricePerSeat: data.pricePerSeat,
      availableSeats: data.totalSeats,
      totalSeats: data.totalSeats,
      recurring: data.recurring,
      preferences: data.preferences,
      ...(company ? { organisation: company._id } : {}),
      parcelInfo: data.parcelInfo,
    });

    // Riders waiting for a ride on this route (UC-R02 6a)
    import('./RideAlertService')
      .then(({ RideAlertService }) => new RideAlertService().notifyMatches(ride))
      .catch((error) => logger.warn('Ride alert matching failed', { rideId: ride._id, error: (error as Error).message }));

    // Publish ride.created event for proactive rider notification
    EventBridge.publish('ride-events', {
      eventType: 'ride.created',
      data: {
        rideId: ride._id,
        driverId,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        departureTime: ride.departureTime,
      },
    });

    return ride;
  }

  /**
   * Search rides with geospatial + temporal filters.
   * CRITICAL: Self-ride exclusion — authenticated user never sees own rides.
   */
  async searchRides(
    authenticatedUserId: string,
    params: RideSearchParams,
    page: number,
    limit: number,
  ): Promise<{ rides: IRide[]; scores: MatchScore[]; total: number; items: SearchResultRide[] }> {
    const radiusMeters = (params.radiusKm || config.ride.defaultSearchRadiusKm) * 1000;
    const timeDeviation = params.timeDeviationMins || config.ride.defaultTimeDeviationMins;
    const departureDate = new Date(params.departureTime);
    const timeMin = new Date(departureDate.getTime() - timeDeviation * 60 * 1000);
    const timeMax = new Date(departureDate.getTime() + timeDeviation * 60 * 1000);

    // Build filter — SELF-RIDE EXCLUSION with $ne
    const filter: FilterQuery<IRide> = {
      status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE] },
      driver: { $ne: new Types.ObjectId(authenticatedUserId) },
      availableSeats: { $gte: 1 },
      departureTime: { $gte: timeMin, $lte: timeMax },
      // The route must also pass near where the rider is going, not just
      // near where they start. $geoIntersects is allowed inside $geoNear's
      // query; $near is not.
      routeLine: {
        $geoIntersects: { $geometry: circlePolygon(params.dropoffLng, params.dropoffLat, radiusMeters) },
      },
    };

    if (params.maxPrice !== undefined) {
      filter.pricePerSeat = { $lte: params.maxPrice };
    }

    // ── Safety: Women-Only Ride Enforcement ──
    const currentUser = await User.findById(authenticatedUserId);
    if (!currentUser) throw new NotFoundError('User');

    // Only women whose identity check passed see women-only rides; a declared
    // gender alone is not enough (IdentityService)
    if (params.womenOnly === true) {
      if (!isVerifiedWoman(currentUser)) throw womenOnlyRefusal(currentUser);
      filter['preferences.womenOnly'] = true;
    } else if (!isVerifiedWoman(currentUser)) {
      filter['preferences.womenOnly'] = { $ne: true };
    }
    // Colleagues-only rides are seen by staff of the same company, while its programme is active
    const myCompany = await activeOrganisationOf(currentUser);
    filter.$or = [{ 'preferences.colleaguesOnly': { $ne: true } }, ...(myCompany ? [{ organisation: myCompany._id }] : [])];
    if (params.hasAC !== undefined) {
      filter['vehicle.hasAC'] = params.hasAC;
    }
    if (params.vehicleType) {
      filter['vehicle.vehicleType'] = params.vehicleType;
    }
    if (params.rideType) {
      filter.rideType = params.rideType;
    }

    // Rides whose route passes within the radius of the rider's pickup,
    // nearest first. $geoNear on a LineString measures to its closest point,
    // so riders can join part-way along the route (UC-R03).
    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [params.pickupLng, params.pickupLat] },
          distanceField: 'pickupDistance',
          maxDistance: radiusMeters,
          spherical: true,
          key: 'routeLine',
          query: filter,
        },
      },
      { $limit: SEARCH_CANDIDATE_LIMIT },
    ];
    const found = (await Ride.aggregate(pipeline)) as Array<IRide & { pickupDistance: number }>;

    // Keep rides going the rider's way: along the route, the rider's pickup
    // must come before their drop
    const pickupPoint = { lat: params.pickupLat, lng: params.pickupLng };
    const dropPoint = { lat: params.dropoffLat, lng: params.dropoffLng };
    const routeDistanceKm = new Map<string, number>();
    const sameDirection = found.filter((ride) => {
      const path = (ride.routeLine?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng }));
      const boarding = nearestOnPath(pickupPoint, path);
      const leaving = nearestOnPath(dropPoint, path);
      routeDistanceKm.set(ride._id.toString(), boarding.distanceKm);
      return leaving.alongKm > boarding.alongKm;
    });

    const driverIds = sameDirection.map((r) => r.driver);
    // With the confidential safety answers, for ranking only; they are not sent back
    const drivers = await User.find({ _id: { $in: driverIds } }).select('+safetyRating');
    const driverMap = new Map(drivers.map((d) => [d._id.toString(), d]));

    // Minimum rating needs the driver, so it is applied here, before paging
    const matching = sameDirection.filter((r) => {
      const driver = driverMap.get(r.driver.toString());
      if (!driver) return false;
      return !params.minRating || (driver.stats.avgRatingAsDriver || 0) >= params.minRating;
    });
    const total = matching.length;
    const enrichedRides = matching.slice((page - 1) * limit, page * limit);

    const candidates = enrichedRides.map((ride) => ({
      ride,
      driver: driverMap.get(ride.driver.toString())!,
      pickupDistanceKm: routeDistanceKm.get(ride._id.toString()),
    }));

    const scores = await this.matchingEngine.scoreRides(candidates, params);
    const scoreByRide = new Map(scores.map((s) => [s.rideId, s]));

    // "Works at": only for drivers at the searcher's own company, never their work email
    const colleagues = await colleaguesOf(currentUser, candidates.map(({ driver }) => driver._id));
    // Public driver details only: phone numbers are shared after a booking is confirmed
    const items: SearchResultRide[] = candidates.map(({ ride, driver }) => ({
      ...withoutRouteLine(ride),
      driver: {
        _id: driver._id.toString(),
        name: driver.name,
        profilePhotoUrl: driver.profilePhotoUrl,
        stats: {
          avgRatingAsDriver: driver.stats?.avgRatingAsDriver ?? 0,
          totalRatingsAsDriver: driver.stats?.totalRatingsAsDriver ?? 0,
          totalRidesAsDriver: driver.stats?.totalRidesAsDriver ?? 0,
        },
        // Verified Driver badge (UC-D10)
        verified: verifiedDriverStatus(driver).verified,
        // Identity checked by an admin; every women-only ride's driver has this
        identityVerified: driver.identity?.status === 'verified',
        // A GPS tracker in this car reported in the last day
        trackedCar: isTracked(driver.vehicles?.find((v) => String(v._id) === String(ride.vehicle?.vehicleId))?.tracker),
        ...(colleagues.has(driver._id.toString()) ? { colleagueAt: colleagues.get(driver._id.toString()) } : {}),
      },
      matchScore: scoreByRide.get(ride._id.toString())?.overallScore,
    }));

    return { rides: enrichedRides, scores, total, items };
  }

  /**
   * Get a single ride by ID.
   */
  async getRideById(rideId: string, viewerId: string): Promise<IRide> {
    const ride = await Ride.findById(rideId);
    if (!ride) throw new NotFoundError('Ride');

    // The driver's phone number is shared only with the driver and riders
    // whose booking on this ride has been confirmed.
    const canSeeContact =
      ride.driver.toString() === viewerId ||
      Boolean(await Booking.exists({ ride: ride._id, rider: viewerId, status: BookingStatus.CONFIRMED }));
    const driverFields = canSeeContact ? 'name phone profilePhotoUrl stats identity.status' : 'name profilePhotoUrl stats identity.status';

    return ride.populate('driver', driverFields);
  }

  /**
   * Get rides created by a specific driver.
   */
  async getDriverRides(
    driverId: string,
    status: RideStatus | undefined,
    page: number,
    limit: number,
  ) {
    const filter: FilterQuery<IRide> = { driver: driverId };
    if (status) filter.status = status;

    const [rides, total] = await Promise.all([
      Ride.find(filter)
        .sort({ departureTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Ride.countDocuments(filter),
    ]);

    return paginate(rides, total, page, limit);
  }

  /**
   * Cancel a ride. Only the driver can cancel. Notifies all booked riders.
   */
  async cancelRide(
    rideId: string,
    driverId: string,
    reason: string,
  ): Promise<IRide> {
    const ride = await Ride.findById(rideId);
    if (!ride) throw new NotFoundError('Ride');

    if (ride.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the ride creator can cancel');
    }

    if (ride.status === RideStatus.COMPLETED || ride.status === RideStatus.CANCELLED) {
      throw new ConflictError('Ride already completed or cancelled');
    }

    // Close the ride first so no new bookings can be made, then cancel and
    // refund each active booking individually.
    ride.status = RideStatus.CANCELLED;
    ride.cancelledAt = new Date();
    ride.cancellationReason = reason;
    await ride.save();

    const activeBookings = await Booking.find({
      ride: rideId,
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    }).select('_id');
    const { BookingService } = await import('./BookingService');
    const bookingService = new BookingService();
    for (const { _id } of activeBookings) {
      try {
        await bookingService.cancelBooking(_id.toString(), driverId, 'Ride cancelled by driver');
      } catch (error) {
        logger.error('Failed to cancel booking for cancelled ride', {
          rideId,
          bookingId: _id,
          error: (error as Error).message,
        });
      }
    }

    EventBridge.publish('ride-events', {
      eventType: 'ride.cancelled',
      data: { rideId, driverId, reason },
    });

    return ride;
  }

  /**
   * The driver changes a published ride (UC-D08): departure within
   * ±2 hours, more seats (never fewer), and the price only while nobody has
   * booked, within ±20%. Allowed until 4 hours before departure. Booked
   * riders are told, and a changed departure lets them cancel for a full
   * refund.
   */
  async updateRide(
    rideId: string,
    driverId: string,
    changes: { departureTime?: string; totalSeats?: number; pricePerSeat?: number },
  ): Promise<IRide> {
    const ride = await Ride.findById(rideId);
    if (!ride) throw new NotFoundError('Ride');
    if (ride.driver.toString() !== driverId) throw new AuthorizationError('Only the ride\'s driver can change it');
    if (ride.status !== RideStatus.SCHEDULED && ride.status !== RideStatus.ACTIVE) {
      throw new ConflictError('Only rides that have not started can be changed');
    }
    const hoursLeft = (ride.departureTime.getTime() - Date.now()) / 3_600_000;
    if (hoursLeft < config.ride.editCutoffHours) {
      throw new AppError(`Rides can be changed until ${config.ride.editCutoffHours} hours before departure. Cancel instead if you cannot go.`, 409, 'TOO_LATE_TO_EDIT');
    }

    const booked = await Booking.find({
      ride: rideId,
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    }).select('_id rider');
    const changed: string[] = [];
    let timeChanged = false;

    if (changes.departureTime !== undefined) {
      const next = new Date(changes.departureTime);
      if (Number.isNaN(next.getTime())) throw new AppError('Invalid departure time', 422, 'VALIDATION_ERROR');
      const shiftHours = Math.abs(next.getTime() - ride.departureTime.getTime()) / 3_600_000;
      if (shiftHours > config.ride.maxDepartureShiftHours) {
        throw new AppError(`The departure can move by at most ${config.ride.maxDepartureShiftHours} hours. Cancel and post a new ride for a bigger change.`, 409, 'SHIFT_TOO_LARGE');
      }
      if (next.getTime() <= Date.now()) throw new AppError('The new departure has already passed', 422, 'VALIDATION_ERROR');
      if (next.getTime() !== ride.departureTime.getTime()) {
        const duration = ride.estimatedArrivalTime.getTime() - ride.departureTime.getTime();
        ride.departureTime = next;
        ride.estimatedArrivalTime = new Date(next.getTime() + duration);
        timeChanged = true;
        changed.push('departure time');
      }
    }

    if (changes.totalSeats !== undefined && changes.totalSeats !== ride.totalSeats) {
      if (changes.totalSeats < ride.totalSeats) {
        throw new AppError('Seats can only be added. Riders who booked keep their seats.', 409, 'SEATS_ONLY_UP');
      }
      const seatLimit = MAX_SEATS_BY_VEHICLE[ride.vehicle.vehicleType] ?? 8;
      if (changes.totalSeats > seatLimit) throw new AppError(`At most ${seatLimit} seat${seatLimit === 1 ? '' : 's'} in this vehicle`, 422, 'VALIDATION_ERROR');
      ride.availableSeats += changes.totalSeats - ride.totalSeats;
      ride.totalSeats = changes.totalSeats;
      changed.push('seats');
    }

    if (changes.pricePerSeat !== undefined && changes.pricePerSeat !== ride.pricePerSeat) {
      if (booked.length > 0) {
        throw new AppError('The price is fixed once someone has booked or asked for a seat', 409, 'PRICE_LOCKED');
      }
      const limit = config.ride.maxPriceChangeRate;
      if (Math.abs(changes.pricePerSeat - ride.pricePerSeat) > ride.pricePerSeat * limit + 0.001) {
        throw new AppError(`The price can change by at most ${Math.round(limit * 100)}% (${money(Math.round(ride.pricePerSeat * (1 - limit)))} to ${money(Math.round(ride.pricePerSeat * (1 + limit)))})`, 409, 'PRICE_CHANGE_TOO_LARGE');
      }
      ride.pricePerSeat = changes.pricePerSeat;
      changed.push('price');
    }

    if (changed.length === 0) return ride;
    await ride.save();

    if (timeChanged && booked.length) {
      await Booking.updateMany({ _id: { $in: booked.map((b) => b._id) } }, { $set: { rideChangedAt: new Date() } });
    }
    EventBridge.publish('ride-events', {
      eventType: 'ride.updated',
      data: {
        rideId,
        driverId,
        changed,
        departureTime: ride.departureTime,
        riderIds: booked.map((b) => b.rider.toString()),
        freeCancellation: timeChanged,
      },
    });
    return ride;
  }

  /**
   * Get upcoming rides for a rider (booked but not yet completed/cancelled).
   */
  async getUpcomingRides(riderId: string) {
    const bookings = await Booking.find({
      rider: riderId,
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    })
      .populate({
        path: 'ride',
        populate: { path: 'driver', select: 'name phone profilePhotoUrl' },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<PopulatedRideBooking[]>();

    const withRide = bookings.filter(
      (b): b is PopulatedRideBooking & { ride: NonNullable<PopulatedRideBooking['ride']> } =>
        b.ride != null,
    );

    return withRide
      .map((b) => ({
        id: b.ride._id,
        pickup: b.ride.pickup,
        dropoff: b.ride.dropoff,
        departureTime: b.ride.departureTime,
        pricePerSeat: b.ride.pricePerSeat,
        // Contact details only once the driver has confirmed the booking
        driver: b.status === BookingStatus.CONFIRMED || !b.ride.driver
          ? b.ride.driver
          : { ...b.ride.driver, phone: undefined },
        status: b.status,
        bookingId: b._id,
      }));
  }

  /**
   * Driver sets off: the ride leaves the search results and riders see it as
   * under way. Needs at least one confirmed rider.
   */
  async startRide(rideId: string, driverId: string): Promise<IRide> {
    const ride = await Ride.findById(rideId);
    if (!ride) throw new NotFoundError('Ride');
    if (ride.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the driver can start the ride');
    }
    if (ride.status !== RideStatus.SCHEDULED && ride.status !== RideStatus.ACTIVE) {
      throw new ConflictError('Only a scheduled ride can be started');
    }

    const confirmed = await Booking.find({ ride: rideId, status: BookingStatus.CONFIRMED }).select('rider');
    if (confirmed.length === 0) {
      throw new ConflictError('Accept at least one rider before starting the ride');
    }

    ride.status = RideStatus.IN_PROGRESS;
    ride.startedAt = new Date();
    await ride.save();

    EventBridge.publish('ride-events', {
      eventType: 'ride.started',
      data: { rideId, driverId, riderIds: confirmed.map((b) => b.rider.toString()) },
    });

    return ride;
  }

  /**
   * Mark the ride completed and settle each confirmed booking on it, which
   * records the driver's earnings and lets riders rate the trip.
   */
  async completeRide(rideId: string, driverId: string): Promise<IRide> {
    const ride = await Ride.findById(rideId);
    if (!ride) throw new NotFoundError('Ride');
    if (ride.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the driver can complete the ride');
    }
    if (ride.status !== RideStatus.IN_PROGRESS && ride.status !== RideStatus.ACTIVE) {
      throw new ConflictError('Ride must be active or in progress to complete');
    }

    ride.status = RideStatus.COMPLETED;
    ride.completedAt = new Date();
    await ride.save();

    const confirmedBookings = await Booking.find({
      ride: rideId,
      status: BookingStatus.CONFIRMED,
    }).select('_id');
    const { BookingService } = await import('./BookingService');
    const bookingService = new BookingService();
    for (const { _id } of confirmedBookings) {
      try {
        await bookingService.completeBooking(_id.toString(), driverId);
      } catch (error) {
        logger.error('Failed to complete booking for completed ride', {
          rideId,
          bookingId: _id,
          error: (error as Error).message,
        });
      }
    }

    EventBridge.publish('ride-events', {
      eventType: 'ride.completed',
      data: { rideId, driverId },
    });

    return ride;
  }

  /**
   * Get an AI-optimized pickup/dropoff sequence for a multi-passenger ride.
   * Employs VRP/TSP algorithms via the ML service.
   */
  async getOptimizedRoute(rideId: string, driverId: string): Promise<OptimizedRouteResult> {
    const ride = await Ride.findById(rideId);
    if (!ride) throw new NotFoundError('Ride');
    if (ride.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the ride creator can optimize the route');
    }

    const bookings = await Booking.find({
      ride: rideId,
      status: BookingStatus.CONFIRMED,
    });

    if (bookings.length === 0) {
      return {
        optimizedOrder: [],
        totalDistanceKm: ride.estimatedDistanceKm,
        segments: [],
      };
    }

    // Build waypoints for ML service
    const waypoints = bookings.flatMap((b) => [
      {
        id: `pickup:${b._id}`,
        lat: b.pickup.location.coordinates[1],
        lng: b.pickup.location.coordinates[0],
      },
      {
        id: `dropoff:${b._id}`,
        lat: b.dropoff.location.coordinates[1],
        lng: b.dropoff.location.coordinates[0],
      },
    ]);

    try {
      const response = await mlClient.post('/api/optimize-route', {
        origin: {
          lat: ride.pickup.location.coordinates[1],
          lng: ride.pickup.location.coordinates[0],
        },
        destination: {
          lat: ride.dropoff.location.coordinates[1],
          lng: ride.dropoff.location.coordinates[0],
        },
        waypoints,
      });

      return response.data as OptimizedRouteResult;
    } catch (error) {
      logger.error('Route optimization failed', { error: (error as Error).message });
      // Fallback to naive order if ML service is down
      return {
        optimizedOrder: waypoints.map((w) => w.id),
        totalDistanceKm: ride.estimatedDistanceKm,
        segments: [],
        fallback: true,
      };
    }
  }
}
