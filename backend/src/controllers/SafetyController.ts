import { Request, Response, NextFunction } from 'express';
import { SafetyService } from '../services/SafetyService';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { SOSCheckInStatus } from '../types';

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
      const user = (req as AuthenticatedRequest).user;
      const { location } = req.body;
      await safetyService.updateSOSLocation(String(req.params.id), user.userId, location);
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
      const user = (req as AuthenticatedRequest).user;
      const { type, url } = req.body;
      await safetyService.addEvidence(String(req.params.id), user.userId, type, url);
      sendSuccess(res, { message: 'Evidence added' }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/sos/:id/check-in
   * Update SOS monitoring state.
   */
  static async updateSOSCheckIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { status, notes, location } = req.body as {
        status: SOSCheckInStatus;
        notes?: string;
        location?: { lng: number; lat: number };
      };
      const record = await safetyService.updateSOSCheckIn(String(req.params.id), user.userId, {
        status,
        notes,
        location,
      });
      sendSuccess(res, { emergency: record }, 200, (req as any).requestId);
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

  /**
   * GET /api/v1/safety/sos/:id
   * Get SOS status by emergency record ID.
   */
  static async getSOSStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const record = await safetyService.getSOSStatus(String(req.params.id), user.userId);
      sendSuccess(res, { emergency: record }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/safety/emergency-contacts
   * Get the authenticated user's emergency contacts.
   */
  static async getEmergencyContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const contacts = await safetyService.getEmergencyContacts(user.userId);
      sendSuccess(res, { contacts }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/safety/emergency-contacts
   * Update the authenticated user's emergency contacts.
   */
  static async updateEmergencyContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const contacts = await safetyService.updateEmergencyContacts(user.userId, req.body.contacts);
      sendSuccess(res, { contacts }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/sos/:id/notify-police (Admin)
   */
  static async notifyPolice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { notes } = req.body as { notes?: string };
      const record = await safetyService.notifyPolice(String(req.params.id), user.userId, notes);
      sendSuccess(res, { emergency: record }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }
}
