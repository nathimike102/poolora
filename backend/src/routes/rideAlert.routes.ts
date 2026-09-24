import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { RideAlertService } from '../services/RideAlertService';
import { sendSuccess } from '../utils/helpers';
import type { AuthenticatedRequest } from '../types';

const router = Router();
const alerts = new RideAlertService();
router.use(authenticate);

const stop = Joi.object({
  lng: Joi.number().min(-180).max(180).required(),
  lat: Joi.number().min(-90).max(90).required(),
  address: Joi.string().trim().min(1).max(300).required(),
});

const userId = (req: Request) => (req as AuthenticatedRequest).user.userId;

/** Tell me when a ride appears on this route (UC-R02 6a) */
router.post(
  '/',
  validate({ body: Joi.object({ pickup: stop.required(), dropoff: stop.required(), departureTime: Joi.date().iso().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, { alert: await alerts.create(userId(req), req.body) }, 201, req.requestId);
    } catch (error) {
      next(error);
    }
  },
);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, { alerts: await alerts.mine(userId(req)) }, 200, req.requestId);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await alerts.remove(userId(req), String(req.params.id));
    sendSuccess(res, { removed: true }, 200, req.requestId);
  } catch (error) {
    next(error);
  }
});

export default router;
