import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { RatingService } from '../services/RatingService';
import { queryInt } from '../utils/request';

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

      sendSuccess(res, { rating }, 201, req.requestId);
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
      const page = queryInt(req, 'page', 1);
      const limit = queryInt(req, 'limit', 20);
      const { ratings, total } = await ratingService.getUserRatings(
        req.params.userId as string,
        page,
        limit
      );

      sendSuccess(
        res,
        { ratings, total, page: page, limit: limit },
        200,
        req.requestId,
      );
    } catch (error) {
      next(error);
    }
  }
}
