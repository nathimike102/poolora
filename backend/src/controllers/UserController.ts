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
        'name phone email profilePhotoUrl capabilities gender stats',
      );
      if (!user) throw new NotFoundError('User');
      sendSuccess(res, { user }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users/saved-routes
   * Placeholder — returns empty array until saved-routes feature is built.
   */
  static async getSavedRoutes(req: Request, res: Response, _next: NextFunction): Promise<void> {
    sendSuccess(res, { routes: [] }, 200, (req as any).requestId);
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
      sendSuccess(res, { user }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/users/kyc/submit
   */
  static async submitKYC(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { KYCService } = await import('../services/KYCService');
      const kycService = new KYCService();
      const result = await kycService.submitKYC(userId, req.body);
      sendSuccess(res, result, 200, (req as any).requestId);
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
      sendSuccess(res, { kyc: user.kyc }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }
}
