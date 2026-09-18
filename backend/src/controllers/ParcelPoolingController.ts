import { Request, Response, NextFunction } from 'express';
import { ParcelPoolingService } from '../services/ParcelPoolingService';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';

const parcelService = new ParcelPoolingService();

export class ParcelPoolingController {
  /**
   * POST /api/v1/parcels/create
   * Create a new parcel pooling request
   */
  static async createParcelRequest(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { parcel, razorpayOrder, deliveryOtp } = await parcelService.createParcelRequest(
        user.userId,
        req.body,
      );
      sendSuccess(
        res,
        { parcel, razorpayOrder, deliveryOtp },
        201,
        (req as any).requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/parcels/:id/accept
   * Accept a parcel delivery request (driver only)
   */
  static async acceptParcelRequest(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const parcel = await parcelService.acceptParcelRequest(
        String(req.params.id),
        user.userId,
      );
      sendSuccess(res, { parcel }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/parcels/:id/pickup
   * Mark parcel as picked up
   */
  static async pickupParcel(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const parcel = await parcelService.pickupParcel(String(req.params.id), user.userId);
      sendSuccess(res, { parcel }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/parcels/:id/deliver
   * Complete parcel delivery with proof
   */
  static async completeDelivery(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { proof } = req.body;
      const parcel = await parcelService.completeDelivery(String(req.params.id), user.userId, proof);
      sendSuccess(res, { parcel }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/parcels/track/:trackingNumber
   * Track parcel by tracking number
   */
  static async trackParcel(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const parcel = await parcelService.getParcelByTracking(
        String(req.params.trackingNumber),
        { userId: user.userId, capabilities: user.capabilities },
      );
      sendSuccess(res, { parcel }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/parcels
   * List user's parcels
   */
  static async listParcels(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { role, skip, limit } = req.query as unknown as {
        role: 'sender' | 'driver' | 'receiver';
        skip: number;
        limit: number;
      };

      const { parcels, total } = await parcelService.listUserParcels(
        user.userId,
        role,
        skip,
        limit,
      );

      sendSuccess(
        res,
        { parcels, pagination: { skip, limit, total } },
        200,
        (req as any).requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/parcels/:id/cancel
   * Cancel parcel delivery
   */
  static async cancelParcel(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { reason } = req.body;
      const parcel = await parcelService.cancelParcel(
        String(req.params.id),
        user.userId,
        reason,
      );
      sendSuccess(res, { parcel }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }
}