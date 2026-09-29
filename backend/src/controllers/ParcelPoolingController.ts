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
      const { parcel, deliveryOtp } = await parcelService.createParcelRequest(
        user.userId,
        req.body,
      );
      sendSuccess(
        res,
        // An online payment is started next with POST /payments/start
        { parcel, deliveryOtp },
        201,
        req.requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/parcels/:id/accept
   * Accept a parcel delivery request (driver only)
   */
  /** GET /api/v1/parcels/quote — what a parcel would cost, before sending */
  static async quote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parcelCost } = await import('../services/ParcelPoolingService');
      const q = req.query as unknown as { pickupLat: number; pickupLng: number; deliveryLat: number; deliveryLng: number; weight: number; insuranceValue?: number };
      const cost = parcelCost({
        pickup: { lat: Number(q.pickupLat), lng: Number(q.pickupLng) },
        delivery: { lat: Number(q.deliveryLat), lng: Number(q.deliveryLng) },
        weightKg: Number(q.weight),
        insuranceValue: q.insuranceValue ? Number(q.insuranceValue) : undefined,
      });
      sendSuccess(res, cost, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/parcels/:id/reject — the driver declines; the sender is refunded */
  static async rejectParcelRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const parcel = await parcelService.rejectParcelRequest(String(req.params.id), user.userId, req.body?.reason);
      sendSuccess(res, { parcel }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

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
      sendSuccess(res, { parcel }, 200, req.requestId);
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
      sendSuccess(res, { parcel }, 200, req.requestId);
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
      sendSuccess(res, { parcel }, 200, req.requestId);
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
      sendSuccess(res, { parcel }, 200, req.requestId);
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
      const { role, skip, limit, rideId } = req.query as unknown as {
        role: 'sender' | 'driver' | 'receiver';
        skip: number;
        limit: number;
        rideId?: string;
      };

      const { parcels, total } = await parcelService.listUserParcels(
        user.userId,
        role,
        skip,
        limit,
        rideId,
      );

      sendSuccess(
        res,
        { parcels, pagination: { skip, limit, total } },
        200,
        req.requestId,
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
      sendSuccess(res, { parcel }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }
}