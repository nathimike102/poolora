import { Request, Response, NextFunction } from 'express';
import { RideService } from '../services/RideService';
import { AuthenticatedRequest, RideSearchParams, RideStatus, RideType, VehicleType } from '../types';
import { sendSuccess, sendPaginated } from '../utils/helpers';
import { AppError } from '../utils/AppError';
import { SocketGateway } from '../sockets/SocketGateway';
import { AnalyticsService } from '../services/AnalyticsService';
import { queryEnum, queryFloat, queryInt, queryString } from '../utils/request';

const rideService = new RideService();
const analyticsService = new AnalyticsService();

export class RideController {
  /**
   * POST /api/v1/rides
   * Create a new ride. Requires driverVerified.
   */
  static async createRide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const ride = await rideService.createRide(user.userId, req.body);
      sendSuccess(res, { ride }, 201, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/rides/search
   * Search rides with geospatial + temporal filters.
   * Self-ride exclusion is enforced in the service layer.
   */
  static async searchRides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      // Coordinates and the departure time are required; the route validator
      // rejects the request before this point if any of them is missing.
      const params: RideSearchParams = {
        pickupLng: queryFloat(req, 'pickupLng') ?? Number.NaN,
        pickupLat: queryFloat(req, 'pickupLat') ?? Number.NaN,
        dropoffLng: queryFloat(req, 'dropoffLng') ?? Number.NaN,
        dropoffLat: queryFloat(req, 'dropoffLat') ?? Number.NaN,
        departureTime: new Date(queryString(req, 'departureTime', '')),
        radiusKm: queryFloat(req, 'radiusKm'),
        timeDeviationMins: queryFloat(req, 'timeDeviationMins'),
        maxPrice: queryFloat(req, 'maxPrice'),
        womenOnly: queryString(req, 'womenOnly') === 'true' ? true : undefined,
        hasAC: queryString(req, 'hasAC') === 'true' ? true : undefined,
        vehicleType: queryEnum(req, 'vehicleType', VehicleType),
        minRating: queryFloat(req, 'minRating'),
        rideType: queryEnum(req, 'rideType', RideType),
      };

      const page = queryInt(req, 'page', 1);
      const limit = queryInt(req, 'limit', 20);

      const result = await rideService.searchRides(user.userId, params, page, limit);

      sendSuccess(
        res,
        {
          items: result.items,
          scores: result.scores,
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
        200,
        req.requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/rides/my-rides
   * Get rides created by the authenticated driver.
   */
  static async getMyRides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const status = queryEnum(req, 'status', RideStatus);
      const page = queryInt(req, 'page', 1);
      const limit = queryInt(req, 'limit', 20);
      const result = await rideService.getDriverRides(
        user.userId,
        status,
        page,
        limit,
      );
      sendPaginated(res, result, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/rides/upcoming
   * Get upcoming rides booked by the authenticated rider.
   */
  static async getUpcomingRides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const rides = await rideService.getUpcomingRides(user.userId);
      sendSuccess(res, { rides }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/rides/:id
   */
  static async getRide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const ride = await rideService.getRideById(String(req.params.id), user.userId);
      sendSuccess(res, { ride }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/rides/:id/cancel
   */
  static async cancelRide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const reason = req.body?.reason ?? '';
      const ride = await rideService.cancelRide(String(req.params.id), user.userId, reason);
      sendSuccess(res, { ride }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/rides/:id/complete
   */
  static async completeRide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const ride = await rideService.completeRide(String(req.params.id), user.userId);
      sendSuccess(res, { ride }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/rides/driver/location
   * Driver pushes live GPS updates (recommended every 5 seconds).
   */
  static async updateDriverLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const {
        bookingId,
        lng,
        lat,
        speed,
        heading,
        accuracy,
        timestamp,
      } = req.body;

      const socketGateway = SocketGateway.getInstance();
      if (!socketGateway) {
        throw new AppError('Realtime gateway is not available', 503, 'REALTIME_UNAVAILABLE');
      }

      const tracking = await socketGateway.handleDriverLocationUpdate(user.userId, {
        bookingId,
        location: { lng, lat },
        speed,
        heading,
        accuracy,
        timestamp,
      });

      sendSuccess(res, { tracking }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/rides/demand-prediction
   * Get predicted demand for a location.
   */
  static async getDemandPrediction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const latNum = queryFloat(req, 'lat');
      const lngNum = queryFloat(req, 'lng');
      if (latNum === undefined || lngNum === undefined) {
        throw new AppError('Latitude and longitude are required', 400);
      }

      if (Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
        throw new AppError('Latitude and longitude are invalid', 400);
      }

      // Uses real ride history for the area rather than a placeholder count
      const prediction = await analyticsService.getDemandPrediction(latNum, lngNum);
      sendSuccess(res, prediction, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/rides/:id/optimize
   * Get AI-optimized route for a driver's active ride.
   */
  static async optimizeRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const result = await rideService.getOptimizedRoute(String(req.params.id), user.userId);
      sendSuccess(res, result, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }
}
