import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { UnifiedAuthService } from '../auth';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';

const authService = new AuthService();
const unifiedAuth = new UnifiedAuthService();

export class AuthController {
  /**
   * POST /api/v1/auth/send-otp
   */
  static async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = req.body;
      const result = await authService.sendOtp(phone);
      sendSuccess(res, result, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/verify-otp
   */
  static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, otp, name, email, dateOfBirth } = req.body;
      const result = await authService.verifyOtp(phone, otp, name, email, dateOfBirth);

      if ('needsProfile' in result) {
        // Correct code, new phone: the app asks for a name and verifies again
        sendSuccess(res, { needsProfile: true }, 200, req.requestId);
        return;
      }

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          isNewUser: result.isNewUser,
        },
        result.isNewUser ? 201 : 200,
        req.requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh-token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshAccessToken(refreshToken);

      sendSuccess(res, tokens, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      await authService.logout(user.userId, user.sessionId);

      sendSuccess(res, { message: 'Logged out successfully' }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const fullUser = await User.findById(user.userId).select('-otpAttempts -otpLastAttemptAt');

      sendSuccess(res, { user: fullUser }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/kyc
   */
  static async submitKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const result = await authService.submitKyc(user.userId, req.body);
      sendSuccess(res, { user: result }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/kyc/:userId/approve (Admin only)
   */
  static async approveKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.approveKyc(String(req.params.userId));
      sendSuccess(res, { user: result }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/kyc/:userId/reject (Admin only)
   */
  static async rejectKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.rejectKyc(String(req.params.userId), req.body.reason);
      sendSuccess(res, { user: result }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/firebase-login
   *
   * Exchange a Firebase ID token for the platform's own JWT session tokens.
   * This lets the React Native client use Firebase auth while still getting
   * access + refresh tokens that the rest of the API understands.
   */
  static async firebaseLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken } = req.body;
      const result = await unifiedAuth.authenticate(idToken);

      // Create a custom JWT session for the resolved user
      const sessionResult = await authService.createSessionForUser(result.user);

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
      };

      res.cookie('access_token', sessionResult.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refresh_token', sessionResult.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: sessionResult.accessToken,
          refreshToken: sessionResult.refreshToken,
        },
        200,
        req.requestId,
      );
    } catch (error) {
      next(error);
    }
  }
}
