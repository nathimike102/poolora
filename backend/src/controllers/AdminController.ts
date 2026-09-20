import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { Booking } from '../models/Booking';
import { Payment } from '../models/Payment';
import { BookingStatus, RideStatus } from '../types';
import { sendSuccess } from '../utils/helpers';
import { logger } from '../utils/logger';
import { AppError, NotFoundError } from '../utils/AppError';
import { queryFloat, queryInt } from '../utils/request';

/**
 * GET /admin/kyc/:userId/documents
 * Temporary links to a driver's submitted KYC documents for review.
 */
export async function getKycDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(String(req.params.userId)).select('name kyc vehicles');
    if (!user) throw new NotFoundError('User');
    const { presignKycDownload } = await import('../services/UploadService');
    const vehicle = user.vehicles[user.vehicles.length - 1];
    const sign = (url?: string) => (url?.startsWith('s3://') ? presignKycDownload(url) : Promise.resolve(null));
    const [licence, registration, insurance, ...photos] = await Promise.all([
      sign(user.kyc.drivingLicenseUrl),
      sign(vehicle?.registrationDocUrl),
      sign(vehicle?.insuranceDocUrl),
      ...(vehicle?.photos ?? []).map(sign),
    ]);
    sendSuccess(
      res,
      {
        name: user.name,
        status: user.kyc.status,
        licenseNumber: user.kyc.licenseNumber,
        vehicle: vehicle && {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          plateNumber: vehicle.plateNumber,
          vehicleType: vehicle.vehicleType,
        },
        documents: { licence, registration, insurance, photos },
      },
      200,
      req.requestId,
    );
  } catch (error) {
    next(error);
  }
}

/** Admin lists are capped so a single request can't pull an entire collection. */
function parsePagination(query: Request['query']): { page: number; limit: number } {
  const page = Math.max(parseInt(String(query.page ?? '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? '20'), 10) || 20, 1), 100);
  return { page, limit };
}

export class AdminController {
  /**
   * GET /api/v1/admin/metrics
   * Get system metrics and statistics
   */
  static async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [
        totalRides,
        activeRides,
        completedToday,
        totalUsers,
        activeDrivers,
        activeRiders,
        totalRevenue,
        avgRating,
      ] = await Promise.all([
        Ride.countDocuments(),
        Ride.countDocuments({ status: { $in: [RideStatus.ACTIVE, RideStatus.IN_PROGRESS] } }),
        Ride.countDocuments({
          status: RideStatus.COMPLETED,
          completedAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        }),
        User.countDocuments(),
        User.countDocuments({ capabilities: 'driver', isOnline: true }),
        User.countDocuments({ capabilities: 'rider', isOnline: true }),
        Payment.aggregate([
          { $match: { status: 'captured' } },
          { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
        ]),
        Booking.aggregate([
          { $match: { status: BookingStatus.COMPLETED } },
          { $group: { _id: null, avgScore: { $avg: '$matchScore' } } },
        ]),
      ]);

      const revenue = totalRevenue[0]?.totalAmount || 0;
      const rating = avgRating[0]?.avgScore || 0;

      const metrics = {
        totalRides,
        activeRides,
        completedToday,
        revenue,
        avgRating: rating,
        totalUsers,
        activeDrivers,
        activeRiders,
      };

      logger.info('System metrics generated');
      sendSuccess(res, { metrics }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/rides
   * Get all rides with filtering
   */
  static async getRides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.query;
      const { page, limit } = parsePagination(req.query);

      const query: Record<string, unknown> = {};
      if (status) {
        query.status = status;
      }

      const skip = (page - 1) * limit;
      const [rides, total] = await Promise.all([
        Ride.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('driver', 'name phone profilePicture')
          .lean(),
        Ride.countDocuments(query),
      ]);

      sendSuccess(
        res,
        { rides, pagination: { page, limit, total } },
        200,
        req.requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/users
   * Get all users with filtering
   */
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, kycStatus } = req.query;
      const { page, limit } = parsePagination(req.query);

      const query: Record<string, unknown> = {};
      if (typeof role === 'string') {
        query.capabilities = role;
      }
      if (typeof kycStatus === 'string') {
        query['kyc.status'] = kycStatus;
      }

      const skip = (page - 1) * limit;
      const [users, total] = await Promise.all([
        User.find(query)
          // Only what the admin lists need; documents are fetched separately with signed links
          .select('name phone email capabilities gender kyc.status kyc.submittedAt stats isSuspended createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(query),
      ]);

      sendSuccess(
        res,
        { users, pagination: { page, limit, total } },
        200,
        req.requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/payments
   * Get payment information
   */
  static async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.query;
      const { page, limit } = parsePagination(req.query);

      const query: Record<string, unknown> = {};
      if (status) {
        query.status = status;
      }

      const skip = (page - 1) * limit;
      const [payments, total] = await Promise.all([
        Payment.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('booking', 'rider driver')
          .lean(),
        Payment.countDocuments(query),
      ]);

      sendSuccess(
        res,
        { payments, pagination: { page, limit, total } },
        200,
        req.requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/demand-heatmap
   * Get geospatial demand clusters for the admin dashboard.
   */
  static async getDemandHeatmap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lat = queryFloat(req, 'lat');
      const lng = queryFloat(req, 'lng');
      const radiusKm = queryInt(req, 'radiusKm', 10);
      if (lat === undefined || lng === undefined) {
        throw new AppError('Latitude and longitude are required', 400);
      }

      const { AnalyticsService } = await import('../services/AnalyticsService');
      const analyticsService = new AnalyticsService();
      const clusters = await analyticsService.getRideClusters(lat, lng, radiusKm);

      sendSuccess(res, { clusters }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }
}
