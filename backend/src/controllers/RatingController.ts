import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { RatingService } from '../services/RatingService';

const ratingService = new RatingService();

export class RatingController {
  /**
   * POST /api/v1/ratings
   * Submit a rating after ride completion.
   */
  static async createRating(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const rating = await ratingService.createRating(user.userId, req.body);

      sendSuccess(res, { rating }, 201, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ratings/user/:userId
   * Get ratings for a specific user.
   */
  static async getUserRatings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query as any;
      const { ratings, total } = await ratingService.getUserRatings(
        req.params.userId as string,
        parseInt(page as string),
        parseInt(limit as string)
      );

      sendSuccess(
        res,
        { ratings, total, page: parseInt(page), limit: parseInt(limit) },
        200,
        (req as any).requestId,
      );
    } catch (error) {
      next(error);
    }
  }
}
