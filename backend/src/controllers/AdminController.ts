import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { Booking } from '../models/Booking';
import { Payment } from '../models/Payment';
import { BookingStatus, RideStatus } from '../types';
import { sendSuccess } from '../utils/helpers';
import { logger } from '../utils/logger';

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
      sendSuccess(res, { metrics }, 200, (req as any).requestId);
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
      const { status, page = 1, limit = 20 } = req.query;

      const query: Record<string, any> = {};
      if (status) {
        query.status = status;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [rides, total] = await Promise.all([
        Ride.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('driver', 'name phone profilePicture')
          .lean(),
        Ride.countDocuments(query),
      ]);

      sendSuccess(
        res,
        { rides, pagination: { page: Number(page), limit: Number(limit), total } },
        200,
        (req as any).requestId,
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
      const { role, kycStatus, page = 1, limit = 20 } = req.query;

      const query: Record<string, any> = {};
      if (role) {
        query.capabilities = role;
      }
      if (kycStatus) {
        query.kycStatus = kycStatus;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password -fcmTokens')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        User.countDocuments(query),
      ]);

      sendSuccess(
        res,
        { users, pagination: { page: Number(page), limit: Number(limit), total } },
        200,
        (req as any).requestId,
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
      const { status, page = 1, limit = 20 } = req.query;

      const query: Record<string, any> = {};
      if (status) {
        query.status = status;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [payments, total] = await Promise.all([
        Payment.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('booking', 'rider driver')
          .lean(),
        Payment.countDocuments(query),
      ]);

      sendSuccess(
        res,
        { payments, pagination: { page: Number(page), limit: Number(limit), total } },
        200,
        (req as any).requestId,
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
      const { lat, lng, radiusKm = '10' } = req.query as any;
      if (!lat || !lng) {
        throw new Error('Latitude and longitude are required');
      }

      const { AnalyticsService } = await import('../services/AnalyticsService');
      const analyticsService = new AnalyticsService();
      const clusters = await analyticsService.getRideClusters(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radiusKm),
      );

      sendSuccess(res, { clusters }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }
}