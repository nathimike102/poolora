import { Request, Response, NextFunction } from 'express';
import { ParcelPoolingService } from '../services/ParcelPoolingService';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendError } from '../utils/helpers';
import { logger } from '../utils/logger';

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
      const { parcel, razorpayOrder } = await parcelService.createParcelRequest(
        user.userId,
        req.body,
      );
      sendSuccess(
        res,
        { parcel, razorpayOrder },
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
      const parcel = await parcelService.pickupParcel(String(req.params.id));
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
      const { proof } = req.body;
      const parcel = await parcelService.completeDelivery(String(req.params.id), proof);
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
      const parcel = await parcelService.getParcelByTracking(
        String(req.params.trackingNumber),
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
      const { role = 'sender', skip = 0, limit = 20 } = req.query;

      const { parcels, total } = await parcelService.listUserParcels(
        user.userId,
        role as 'sender' | 'driver' | 'receiver',
        Number(skip),
        Number(limit),
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