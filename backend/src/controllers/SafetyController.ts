import { Request, Response, NextFunction } from 'express';
import { SafetyService } from '../services/SafetyService';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';

const safetyService = new SafetyService();

export class SafetyController {
  /**
   * POST /api/v1/safety/sos
   * Trigger SOS emergency. High-priority endpoint.
   */
  static async triggerSOS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const record = await safetyService.triggerSOS(user.userId, req.body);
      sendSuccess(res, { emergency: record }, 201, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/sos/:id/location
   * Update SOS location during high-frequency tracking.
   */
  static async updateSOSLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { location } = req.body;
      await safetyService.updateSOSLocation(String(req.params.id), location);
      sendSuccess(res, { message: 'Location updated' }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/sos/:id/evidence
   * Upload evidence during SOS.
   */
  static async addEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, url } = req.body;
      await safetyService.addEvidence(String(req.params.id), type, url);
      sendSuccess(res, { message: 'Evidence added' }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/sos/:id/acknowledge (Admin)
   */
  static async acknowledgeSOS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const record = await safetyService.acknowledgeSOS(String(req.params.id), user.userId);
      sendSuccess(res, { emergency: record }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/sos/:id/resolve (Admin)
   */
  static async resolveSOS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { notes, isFalseAlarm } = req.body;
      const record = await safetyService.resolveSOS(
        String(req.params.id),
        user.userId,
        notes || '',
        isFalseAlarm || false,
      );
      sendSuccess(res, { emergency: record }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/safety/sos/active (Admin)
   * Get all active SOS incidents.
   */
  static async getActiveIncidents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query as any;
      const result = await safetyService.getActiveIncidents(parseInt(page), parseInt(limit));
      sendSuccess(res, result, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }
}
