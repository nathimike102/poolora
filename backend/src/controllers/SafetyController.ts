import { Request, Response, NextFunction } from 'express';
import { SafetyService } from '../services/SafetyService';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { SOSCheckInStatus } from '../types';
import { queryInt } from '../utils/request';

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
      sendSuccess(res, { emergency: record }, 201, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/safety/sos/current
   * The caller's open SOS, or else the booking an SOS would be about.
   */
  static async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const result = await safetyService.getCurrent(user.userId);
      sendSuccess(res, result, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/sos/:id/cancel
   * Cancel an accidental SOS inside the window, before contacts are texted.
   */
  static async cancelSOS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const record = await safetyService.cancelSOS(String(req.params.id), user.userId);
      sendSuccess(res, { emergency: record }, 200, req.requestId);
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
      const { location, battery } = req.body as { location: { lng: number; lat: number }; battery?: number };
      const open = await safetyService.updateSOSLocation(String(req.params.id), user.userId, location, battery);
      sendSuccess(res, { message: open ? 'Location updated' : 'This SOS is closed', open }, 200, req.requestId);
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
      sendSuccess(res, { message: 'Evidence added' }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/sos/:id/details
   * "What's happening?": who or what the danger is. Body: threat.
   */
  static async details(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const record = await safetyService.setThreat(String(req.params.id), user.userId, req.body.threat);
      sendSuccess(res, { emergency: record }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/sos/:id/audio-upload
   * A presigned upload for one chunk of SOS audio. Body: contentType.
   */
  static async audioUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const upload = await safetyService.audioUploadFor(String(req.params.id), user.userId, String(req.body?.contentType ?? ''));
      sendSuccess(res, upload, 200, req.requestId);
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
      sendSuccess(res, { emergency: record }, 200, req.requestId);
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
      sendSuccess(res, { emergency: record }, 200, req.requestId);
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
      sendSuccess(res, { emergency: record }, 200, req.requestId);
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
      const page = queryInt(req, 'page', 1);
      const limit = queryInt(req, 'limit', 20);
      const result = await safetyService.getActiveIncidents(page, limit);
      sendSuccess(res, result, 200, req.requestId);
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
      sendSuccess(res, { emergency: record }, 200, req.requestId);
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
      const { EmergencyContactService } = await import('../services/EmergencyContactService');
      const contacts = await new EmergencyContactService().list(user.userId);
      sendSuccess(res, { contacts }, 200, req.requestId);
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
      const { EmergencyContactService } = await import('../services/EmergencyContactService');
      const contacts = await new EmergencyContactService().replace(user.userId, req.body.contacts);
      sendSuccess(res, { contacts }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/safety/emergency-contacts/:contactId/verify
   * Texts the contact a link to confirm (UC-R10 steps 6-7).
   */
  static async verifyEmergencyContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { EmergencyContactService } = await import('../services/EmergencyContactService');
      const result = await new EmergencyContactService().sendVerification(user.userId, String(req.params.contactId));
      sendSuccess(res, result, 200, req.requestId);
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
      sendSuccess(res, { emergency: record }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /safety/ride-check-in — the rider answers an in-ride "Are you OK?"
   * prompt. Body: bookingId, status ('ok' or 'help'), optional location.
   */
  static async rideCheckIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { bookingId, status, location } = req.body as { bookingId: string; status: 'ok' | 'help'; location?: { lng: number; lat: number } };
      const { RideCheckInService } = await import('../services/RideCheckInService');
      const result = await new RideCheckInService().respond(user.userId, bookingId, status, location);
      sendSuccess(res, result, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }
}
