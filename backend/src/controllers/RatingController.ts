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

  /** GET /api/v1/ratings/pending — trips the caller can still rate (within 7 days) */
  static async pending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      sendSuccess(res, { trips: await ratingService.pending(user.userId) }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/ratings/user/:userId/summary?as=driver|rider — average overall and category scores */
  static async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const as = req.query.as === 'rider' ? 'rider' : 'driver';
      sendSuccess(res, await ratingService.summary(String(req.params.userId), as), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ratings/user/:userId?as=driver|rider
   * Get ratings for a specific user, optionally only those received in one role.
   */
  static async getUserRatings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = queryInt(req, 'page', 1);
      const limit = queryInt(req, 'limit', 20);
      // ?as=driver: ratings riders gave this user as a driver; ?as=rider: the reverse
      const as = req.query.as === 'driver' || req.query.as === 'rider' ? req.query.as : undefined;
      const { ratings, total } = await ratingService.getUserRatings(
        req.params.userId as string,
        page,
        limit,
        as,
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
