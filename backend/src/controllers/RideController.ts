import { Request, Response, NextFunction } from 'express';
import { RideService } from '../services/RideService';
import { AuthenticatedRequest, RideSearchParams } from '../types';
import { sendSuccess, sendPaginated } from '../utils/helpers';
import { AppError } from '../utils/AppError';
import { SocketGateway } from '../sockets/SocketGateway';
import { AnalyticsService } from '../services/AnalyticsService';

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
      sendSuccess(res, { ride }, 201, (req as any).requestId);
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
      const query = req.query as any;

      const params: RideSearchParams = {
        pickupLng: parseFloat(query.pickupLng),
        pickupLat: parseFloat(query.pickupLat),
        dropoffLng: parseFloat(query.dropoffLng),
        dropoffLat: parseFloat(query.dropoffLat),
        departureTime: new Date(query.departureTime),
        radiusKm: query.radiusKm ? parseFloat(query.radiusKm) : undefined,
        timeDeviationMins: query.timeDeviationMins ? parseInt(query.timeDeviationMins) : undefined,
        maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
        womenOnly: query.womenOnly === 'true' ? true : undefined,
        hasAC: query.hasAC === 'true' ? true : undefined,
        vehicleType: query.vehicleType || undefined,
        minRating: query.minRating ? parseFloat(query.minRating) : undefined,
        rideType: query.rideType || undefined,
      };

      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;

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
        (req as any).requestId,
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
      const { status, page = '1', limit = '20' } = req.query as any;
      const result = await rideService.getDriverRides(
        user.userId,
        status,
        parseInt(page),
        parseInt(limit),
      );
      sendPaginated(res, result, (req as any).requestId);
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
      sendSuccess(res, { rides }, 200, (req as any).requestId);
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
      sendSuccess(res, { ride }, 200, (req as any).requestId);
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
      sendSuccess(res, { ride }, 200, (req as any).requestId);
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
      sendSuccess(res, { ride }, 200, (req as any).requestId);
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

      sendSuccess(res, { tracking }, 200, (req as any).requestId);
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
      const { lat, lng } = req.query as any;
      if (!lat || !lng) {
        throw new AppError('Latitude and longitude are required', 400);
      }

      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (!Number.isFinite(latNum) || Math.abs(latNum) > 90 || !Number.isFinite(lngNum) || Math.abs(lngNum) > 180) {
        throw new AppError('Latitude and longitude are invalid', 400);
      }

      // Uses real ride history for the area rather than a placeholder count
      const prediction = await analyticsService.getDemandPrediction(latNum, lngNum);
      sendSuccess(res, prediction, 200, (req as any).requestId);
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
      sendSuccess(res, result, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }
}
