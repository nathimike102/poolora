import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/BookingService';
import { AuthenticatedRequest, BookingStatus } from '../types';
import { sendSuccess, sendPaginated } from '../utils/helpers';
import { queryEnum, queryInt } from '../utils/request';

const bookingService = new BookingService();

export class BookingController {
  /**
   * POST /api/v1/bookings
   * Create a booking request. Unless it was paid from the wallet, the app
   * pays for it next with POST /payments/start.
   */
  /** POST /api/v1/bookings/quote: the fare, the company's part and the rider's, before booking (UC-C01) */
  static async quote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      sendSuccess(res, await bookingService.quote(user.userId, req.body), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  static async createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const result = await bookingService.createBooking(user.userId, req.body);
      sendSuccess(
        res,
        {
          booking: result.booking,
          paidViaWallet: result.paidViaWallet,
        },
        201,
        req.requestId,
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
      sendSuccess(res, { booking }, 200, req.requestId);
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
      sendSuccess(res, { booking }, 200, req.requestId);
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
      sendSuccess(res, { booking }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** GET /bookings/:id/receipt — for the rider or driver (UC-R04 step 11) */
  static async receipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { ReceiptService } = await import('../services/ReceiptService');
      const service = new ReceiptService();
      const receipt = await service.build(String(req.params.id), user.userId);
      sendSuccess(res, { receipt, text: service.text(receipt) }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** POST /bookings/:id/receipt/email — a copy to the caller's email address */
  static async emailReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { ReceiptService } = await import('../services/ReceiptService');
      const result = await new ReceiptService().email(String(req.params.id), user.userId);
      sendSuccess(res, result, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** POST /bookings/:id/share — a link for trusted contacts to follow the trip (UC-R08) */
  static async share(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { TripShareService } = await import('../services/TripShareService');
      const result = await new TripShareService().create(user.userId, String(req.params.id));
      sendSuccess(res, result, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** POST /bookings/:id/arrived — the driver is at this rider's pickup */
  static arrived = BookingController.driverStep((id, driverId) => bookingService.markArrived(id, driverId));
  /** POST /bookings/:id/picked-up */
  static pickedUp = BookingController.driverStep((id, driverId, body) => bookingService.markPickedUp(id, driverId, typeof body?.pin === 'string' ? body.pin : undefined));
  /** POST /bookings/:id/in-car — the rider confirms the pickup from their own app */
  static riderInCar = BookingController.driverStep((id, riderId) => bookingService.riderConfirmsPickup(id, riderId));
  /** POST /bookings/:id/dropped-off — settles this rider's booking */
  static droppedOff = BookingController.driverStep((id, driverId) => bookingService.markDroppedOff(id, driverId));
  /** POST /bookings/:id/no-show — after the waiting time at the pickup */
  static noShow = BookingController.driverStep((id, driverId) => bookingService.reportNoShow(id, driverId));

  private static driverStep(fn: (bookingId: string, userId: string, body?: Record<string, unknown>) => Promise<unknown>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = (req as AuthenticatedRequest).user;
        const booking = await fn(String(req.params.id), user.userId, req.body);
        sendSuccess(res, { booking }, 200, req.requestId);
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * GET /bookings/:id/cancellation-quote — refund the caller would get now.
   */
  static async getCancellationQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const quote = await bookingService.getCancellationQuote(String(req.params.id), user.userId);
      sendSuccess(res, quote, 200, req.requestId);
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
      sendSuccess(res, { booking }, 200, req.requestId);
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
      const status = queryEnum(req, 'status', BookingStatus);
      const page = queryInt(req, 'page', 1);
      const limit = queryInt(req, 'limit', 20);
      const result = await bookingService.getUserBookings(
        user.userId,
        'rider',
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
   * GET /api/v1/bookings/as-driver
   */
  static async getDriverBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const status = queryEnum(req, 'status', BookingStatus);
      const page = queryInt(req, 'page', 1);
      const limit = queryInt(req, 'limit', 20);
      const result = await bookingService.getUserBookings(
        user.userId,
        'driver',
        status,
        page,
        limit,
      );
      sendPaginated(res, result, req.requestId);
    } catch (error) {
      next(error);
    }
  }
}
