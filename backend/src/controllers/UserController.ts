import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { NotFoundError } from '../utils/AppError';
import { AccountClosureService } from '../services/AccountClosureService';

const closure = new AccountClosureService();

export class UserController {
  /**
   * GET /api/v1/users/me
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const user = await User.findById(userId).select(
        'name phone email profilePhotoUrl capabilities gender language identity.status stats kyc.status kyc.rejectionReason vehicles createdAt',
      );
      if (!user) throw new NotFoundError('User');
      sendSuccess(res, { user }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/me/closure
   * Whether the account can be closed now, and what is in the way if not.
   */
  static async closureCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      sendSuccess(res, await closure.check(userId), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /users/me
   * Closes the account and removes the personal data. Body: `confirm: true`, optional `reason`.
   */
  static async closeAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { reason } = req.body as { reason?: string };
      sendSuccess(res, await closure.close(userId, reason), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/me
   * Update the signed-in user's name, email and date of birth. The phone number is verified
   * by OTP and cannot be changed here.
   */
  static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { name, email, dateOfBirth, gender, language } = req.body as { name?: string; email?: string | null; dateOfBirth?: Date; gender?: string; language?: string };
      if (gender !== undefined) {
        const { IdentityService } = await import('../services/IdentityService');
        await new IdentityService().setDeclaredGender(userId, gender);
      }
      const update: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};
      if (name !== undefined) update.name = name;
      if (dateOfBirth !== undefined) update.dateOfBirth = dateOfBirth;
      if (language !== undefined) update.language = language;
      // A different address is only typed in, so it is not verified until its owner signs in with it
      if (email) {
        const current = await User.findById(userId).select('email').lean();
        if (current?.email !== String(email).trim().toLowerCase()) {
          update.email = email;
          unset.emailVerifiedAt = '';
        }
      } else if (email === null || email === '') {
        unset.email = '';
        unset.emailVerifiedAt = '';
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { ...(Object.keys(update).length ? { $set: update } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { new: true, runValidators: true },
      ).select('name phone email dateOfBirth profilePhotoUrl capabilities gender language identity.status stats kyc.status kyc.rejectionReason createdAt');
      if (!user) throw new NotFoundError('User');
      sendSuccess(res, { user }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** GET /users/me/identity: the caller's identity check (women-only rides) */
  static async identityStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { IdentityService } = await import('../services/IdentityService');
      sendSuccess(res, { identity: await new IdentityService().status(userId) }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** POST /users/me/identity: send an ID document and a selfie for review */
  static async submitIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { IdentityService } = await import('../services/IdentityService');
      sendSuccess(res, { identity: await new IdentityService().submit(userId, req.body) }, 201, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** GET /users/me/work: the caller's company programme, or the address waiting to be confirmed (UC-C02) */
  static async work(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { OrganisationService } = await import('../services/OrganisationService');
      sendSuccess(res, await new OrganisationService().status(userId), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** POST /users/me/work: send a confirmation link to a work email. Body: email */
  static async joinWork(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { OrganisationService } = await import('../services/OrganisationService');
      sendSuccess(res, await new OrganisationService().requestJoin(userId, req.body?.email), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /users/me/work: leave the company programme */
  static async leaveWork(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { OrganisationService } = await import('../services/OrganisationService');
      sendSuccess(res, await new OrganisationService().leave(userId), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** PUT /users/me/push-token: this phone gets the caller's push notifications */
  static async savePushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { registerPushToken } = await import('../services/PushTokens');
      await registerPushToken(userId, String(req.body.token));
      sendSuccess(res, { saved: true }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /users/me/push-token: signing out on this phone */
  static async removePushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { removePushToken } = await import('../services/PushTokens');
      await removePushToken(userId, String(req.body.token));
      sendSuccess(res, { removed: true }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** PUT /users/me/photo: the caller's profile picture */
  static async setPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { ProfilePhotoService } = await import('../services/ProfilePhotoService');
      const profilePhotoUrl = await ProfilePhotoService.set(userId, String(req.body.data));
      sendSuccess(res, { profilePhotoUrl }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** POST /users/me/phone/code: sends a code to a number to add or change */
  static async sendPhoneCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { AuthService } = await import('../services/AuthService');
      sendSuccess(res, await new AuthService().sendPhoneCode(userId, req.body.phone), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** PUT /users/me/phone: saves the number once its code is right */
  static async confirmPhone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { AuthService } = await import('../services/AuthService');
      const user = await new AuthService().confirmPhone(userId, req.body.phone, req.body.otp);
      sendSuccess(res, { phone: user.phone }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /users/me/photo */
  static async removePhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { ProfilePhotoService } = await import('../services/ProfilePhotoService');
      await ProfilePhotoService.remove(userId);
      sendSuccess(res, { removed: true }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** GET /users/me/impact: CO₂ saved by the caller's shared trips (UC-R11) */
  static async impact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { CarbonService } = await import('../services/CarbonService');
      sendSuccess(res, await new CarbonService().impact(userId), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** GET /users/me/trackers: the driver's cars and their GPS trackers */
  static async trackers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { TrackerService } = await import('../services/TrackerService');
      sendSuccess(res, await new TrackerService().status(userId), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** PUT /users/me/vehicles/:vehicleId/tracker: link a tracker. Body: deviceId */
  static async linkTracker(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { TrackerService } = await import('../services/TrackerService');
      sendSuccess(res, await new TrackerService().link(userId, String(req.params.vehicleId), req.body.deviceId), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /users/me/vehicles/:vehicleId/tracker */
  static async unlinkTracker(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { TrackerService } = await import('../services/TrackerService');
      sendSuccess(res, await new TrackerService().unlink(userId, String(req.params.vehicleId)), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users/saved-routes
   * Placeholder — returns empty array until saved-routes feature is built.
   */
  static async getSavedRoutes(req: Request, res: Response, _next: NextFunction): Promise<void> {
    sendSuccess(res, { routes: [] }, 200, req.requestId);
  }

  /**
   * GET /api/v1/users/:id
   */
  static async getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await User.findById(id).select(
        'name profilePhotoUrl capabilities gender identity.status stats createdAt',
      );
      if (!user) throw new NotFoundError('User');
      sendSuccess(res, { user }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users/kyc/status
   */
  static async getKYCStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const user = await User.findById(userId).select('kyc');
      if (!user) throw new NotFoundError('User');
      sendSuccess(res, { kyc: user.kyc }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** GET /users/me/statement?month=2026-09[&format=csv] — earnings for a month (UC-D09) */
  static async statement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { DriverService } = await import('../services/DriverService');
      const service = new DriverService();
      const month = String(req.query.month ?? new Date().toISOString().slice(0, 7));
      const statement = await service.statement(user.userId, month);
      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="siham-earnings-${month}.csv"`);
        res.status(200).send(service.statementCsv(statement));
        return;
      }
      sendSuccess(res, statement, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** POST /users/me/statement/email — the month's statement by email, as a spreadsheet */
  static async emailStatement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { DriverService } = await import('../services/DriverService');
      const month = String(req.body?.month ?? new Date().toISOString().slice(0, 7));
      sendSuccess(res, await new DriverService().emailStatement(user.userId, month), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** GET /users/me/verified-status — progress towards the Verified Driver badge (UC-D10) */
  static async verifiedStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { User } = await import('../models/User');
      const { verifiedDriverStatus } = await import('../services/DriverService');
      const me = await User.findById(user.userId);
      if (!me) throw new Error('User not found');
      sendSuccess(res, verifiedDriverStatus(me), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }
}
