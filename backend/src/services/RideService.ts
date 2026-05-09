import mongoose, { Types } from 'mongoose';
import { Ride, IRide } from '../models/Ride';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { config } from '../config';
import {
  RideStatus,
  RideSearchParams,
  MatchScore,
  BookingStatus,
  KYCStatus,
} from '../types';
import {
  AppError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
} from '../utils/AppError';
import { toGeoPoint, paginate } from '../utils/helpers';
import { MatchingEngineClient } from './MatchingEngineClient';
import { getRoute } from './MapsService';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';

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
      preferences: any;
      parcelInfo?: any;
    },
  ): Promise<IRide> {
    // Verify driver exists and is approved
    const driver = await User.findById(driverId);
    if (!driver) throw new NotFoundError('User');
    if (driver.kyc.status !== KYCStatus.APPROVED) {
      throw new AuthorizationError('Driver KYC not approved');
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
      (v) => (v as any)._id?.toString() === data.vehicleId,
    );
    if (!vehicle) {
      throw new NotFoundError('Vehicle');
    }

    // Get real route data from Google Directions API
    let estimatedDistanceKm: number;
    let estimatedDurationMins: number;
    let routePolyline: string;

    try {
      const routeData = await getRoute(
        { lat: data.pickup.lat, lng: data.pickup.lng },
        { lat: data.dropoff.lat, lng: data.dropoff.lng },
      );
      estimatedDistanceKm = routeData.distanceKm;
      estimatedDurationMins = routeData.durationMins;
      routePolyline = routeData.polyline;
    } catch (error) {
      // Fallback to haversine estimate if Google API is unavailable
      logger.warn('Google Directions API unavailable, using haversine fallback', {
        error: (error as Error).message,
      });
      const { haversineDistanceKm } = await import('../utils/helpers');
      estimatedDistanceKm = Math.round(
        haversineDistanceKm(data.pickup.lat, data.pickup.lng, data.dropoff.lat, data.dropoff.lng) * 100,
      ) / 100;
      estimatedDurationMins = Math.round((estimatedDistanceKm / 30) * 60); // ~30 km/h avg
      routePolyline = '';
    }

    const departureTime = new Date(data.departureTime);
    const estimatedArrivalTime = new Date(
      departureTime.getTime() + estimatedDurationMins * 60 * 1000,
    );

    const ride = await Ride.create({
      driver: driverId,
      rideType: data.rideType,
      status: RideStatus.SCHEDULED,
      vehicle: {
        vehicleId: (vehicle as any)._id,
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
      parcelInfo: data.parcelInfo,
    });

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
  ): Promise<{ rides: IRide[]; scores: MatchScore[]; total: number }> {
    const radiusMeters = (params.radiusKm || config.ride.defaultSearchRadiusKm) * 1000;
    const timeDeviation = params.timeDeviationMins || config.ride.defaultTimeDeviationMins;
    const departureDate = new Date(params.departureTime);
    const timeMin = new Date(departureDate.getTime() - timeDeviation * 60 * 1000);
    const timeMax = new Date(departureDate.getTime() + timeDeviation * 60 * 1000);

    // Build filter — SELF-RIDE EXCLUSION with $ne
    const filter: any = {
      status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE] },
      driver: { $ne: new Types.ObjectId(authenticatedUserId) },
      availableSeats: { $gte: 1 },
      departureTime: { $gte: timeMin, $lte: timeMax },
    };

    if (params.maxPrice !== undefined) {
      filter.pricePerSeat = { $lte: params.maxPrice };
    }
    if (params.womenOnly !== undefined) {
      filter['preferences.womenOnly'] = params.womenOnly;
    }
    if (params.hasAC !== undefined) {
      filter['vehicle.hasAC'] = params.hasAC;
    }
    if (params.vehicleType) {
      filter['vehicle.vehicleType'] = params.vehicleType;
    }
    if (params.rideType) {
      filter.rideType = params.rideType;
    }

    // Geospatial query using $geoNear via aggregation
    const pipeline: any[] = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [params.pickupLng, params.pickupLat],
          },
          distanceField: 'pickupDistance',
          maxDistance: radiusMeters,
          spherical: true,
          key: 'pickup.location',
          query: filter,
        },
      },
      { $sort: { pickupDistance: 1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          rides: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
    ];

    const [result] = await Ride.aggregate(pipeline);
    const total = result.metadata[0]?.total || 0;
    const rides = result.rides as IRide[];

    // Minimum rating filter (post-query since it requires driver lookup)
    // Fetch drivers once for both filtering and scoring
    const driverIds = rides.map((r: any) => r.driver);
    const drivers = await User.find({ _id: { $in: driverIds } });
    const driverMap = new Map(drivers.map((d) => [d._id.toString(), d]));

    // Minimum rating filter
    let enrichedRides = rides;
    if (params.minRating) {
      enrichedRides = rides.filter((r: any) => {
        const driver = driverMap.get(r.driver.toString());
        return driver && (driver.stats.avgRatingAsDriver || 0) >= params.minRating!;
      });
    }

    const candidates = enrichedRides.map((ride: any) => ({
      ride,
      driver: driverMap.get(ride.driver.toString())!,
    })).filter((c) => c.driver);

    const scores = await this.matchingEngine.scoreRides(candidates, params);

    return { rides: enrichedRides, scores, total };
  }

  /**
   * Get a single ride by ID.
   */
  async getRideById(rideId: string): Promise<IRide> {
    const ride = await Ride.findById(rideId).populate('driver', 'name phone profilePhotoUrl stats');
    if (!ride) throw new NotFoundError('Ride');
    return ride;
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
    const filter: any = { driver: driverId };
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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      ride.status = RideStatus.CANCELLED;
      ride.cancelledAt = new Date();
      ride.cancellationReason = reason;
      await ride.save({ session });

      // Cancel all active bookings for this ride
      await Booking.updateMany(
        { ride: rideId, status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
        {
          $set: {
            status: BookingStatus.CANCELLED,
            cancelledBy: new Types.ObjectId(driverId),
            cancellationReason: 'Ride cancelled by driver',
            cancelledAt: new Date(),
          },
        },
        { session },
      );

      await session.commitTransaction();

      EventBridge.publish('ride-events', {
        eventType: 'ride.cancelled',
        data: { rideId, driverId, reason },
      });

      return ride;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Mark a ride as completed after all dropoffs.
   */
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
      .lean();

    return bookings
      .filter((b: any) => b.ride != null)
      .map((b: any) => ({
        id: b.ride._id,
        pickup: b.ride.pickup,
        dropoff: b.ride.dropoff,
        departureTime: b.ride.departureTime,
        pricePerSeat: b.ride.pricePerSeat,
        driver: b.ride.driver,
        status: b.status,
        bookingId: b._id,
      }));
  }

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

    EventBridge.publish('ride-events', {
      eventType: 'ride.completed',
      data: { rideId, driverId },
    });

    return ride;
  }
}
