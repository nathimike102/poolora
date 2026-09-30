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
        'name phone email profilePhotoUrl capabilities gender stats kyc.status kyc.rejectionReason vehicles createdAt',
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
      const { name, email, dateOfBirth } = req.body as { name?: string; email?: string | null; dateOfBirth?: Date };
      const update: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};
      if (name !== undefined) update.name = name;
      if (dateOfBirth !== undefined) update.dateOfBirth = dateOfBirth;
      if (email) update.email = email;
      else if (email === null || email === '') unset.email = '';

      const user = await User.findByIdAndUpdate(
        userId,
        { ...(Object.keys(update).length ? { $set: update } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { new: true, runValidators: true },
      ).select('name phone email dateOfBirth profilePhotoUrl capabilities gender stats kyc.status kyc.rejectionReason createdAt');
      if (!user) throw new NotFoundError('User');
      sendSuccess(res, { user }, 200, req.requestId);
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
        'name profilePhotoUrl capabilities gender stats createdAt',
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
        res.setHeader('Content-Disposition', `attachment; filename="poolora-earnings-${month}.csv"`);
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
