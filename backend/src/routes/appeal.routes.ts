import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { AppealService } from '../services/AppealService';
import { sendSuccess } from '../utils/helpers';
import type { AuthenticatedRequest } from '../types';

/**
 * Appeals against a suspension or block (UC-A05 3a). Blocked accounts are
 * let through to these routes only (see auth.middleware.ts).
 */
const router = Router();
const appeals = new AppealService();
router.use(authenticate);

const userId = (req: Request) => (req as AuthenticatedRequest).user.userId;
const run = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await fn(req), status, req.requestId);
  } catch (error) {
    next(error);
  }
};

/** GET /appeals/mine — the account's restriction, whether it can be appealed, and past appeals */
router.get('/mine', run((req) => appeals.mine(userId(req))));

/** POST /appeals — { message } */
router.post(
  '/',
  validate({ body: Joi.object({ message: Joi.string().trim().min(20).max(2000).required() }) }),
  run((req) => appeals.file(userId(req), req.body.message), 201),
);

export default router;
