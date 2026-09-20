import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { NotFoundError } from '../utils/AppError';

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
   * PATCH /users/me
   * Update the signed-in user's name and email. The phone number is verified
   * by OTP and cannot be changed here.
   */
  static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { name, email } = req.body as { name?: string; email?: string | null };
      const update: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};
      if (name !== undefined) update.name = name;
      if (email) update.email = email;
      else if (email === null || email === '') unset.email = '';

      const user = await User.findByIdAndUpdate(
        userId,
        { ...(Object.keys(update).length ? { $set: update } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { new: true, runValidators: true },
      ).select('name phone email profilePhotoUrl capabilities gender stats kyc.status kyc.rejectionReason createdAt');
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
}
