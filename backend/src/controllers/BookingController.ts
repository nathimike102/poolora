import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { BookingService } from '../services/BookingService';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendPaginated } from '../utils/helpers';

const bookingService = new BookingService();

export class BookingController {
  /**
   * POST /api/v1/bookings
   * Create a booking request with Razorpay order.
   */
  static async createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const result = await bookingService.createBooking(user.userId, req.body);
      sendSuccess(
        res,
        {
          booking: result.booking,
          razorpayOrder: result.razorpayOrder,
          paidViaWallet: Boolean(result.paidViaWallet),
          // Public key id the app needs to open Razorpay Checkout for this order
          razorpayKeyId: result.razorpayOrder ? config.razorpay.keyId : undefined,
        },
        201,
        (req as any).requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/bookings/:id/confirm
   * Driver confirms a booking.
   */
  static async confirmBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const booking = await bookingService.confirmBooking(String(req.params.id), user.userId);
      sendSuccess(res, { booking }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/bookings/:id/reject
   */
  static async rejectBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const reason = req.body?.reason ?? '';
      const booking = await bookingService.rejectBooking(String(req.params.id), user.userId, reason);
      sendSuccess(res, { booking }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/bookings/:id/cancel
   */
  static async cancelBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const reason = req.body?.reason ?? '';
      const booking = await bookingService.cancelBooking(String(req.params.id), user.userId, reason);
      sendSuccess(res, { booking }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/bookings/:id/complete
   */
  static async completeBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const booking = await bookingService.completeBooking(String(req.params.id), user.userId);
      sendSuccess(res, { booking }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/bookings/as-rider
   */
  static async getRiderBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { status, page = '1', limit = '20' } = req.query as any;
      const result = await bookingService.getUserBookings(
        user.userId,
        'rider',
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
   * GET /api/v1/bookings/as-driver
   */
  static async getDriverBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { status, page = '1', limit = '20' } = req.query as any;
      const result = await bookingService.getUserBookings(
        user.userId,
        'driver',
        status,
        parseInt(page),
        parseInt(limit),
      );
      sendPaginated(res, result, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }
}
