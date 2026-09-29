import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { CallService, maskedCallsEnabled } from '../services/CallService';
import { config } from '../config';
import { sendSuccess } from '../utils/helpers';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../types';

/** Masked calls between riders and drivers (UC-D06) */
const router = Router();
const calls = new CallService();

/** Twilio's callbacks: no login, but every request must carry Twilio's signature */
const twilioHook = (handler: (callId: string, params: Record<string, string>) => Promise<void>) =>
  async (req: Request, res: Response) => {
    const url = `${config.app.baseUrl.replace(/\/$/, '')}${req.originalUrl}`;
    if (!calls.verifyWebhook(req.header('x-twilio-signature'), url, req.body ?? {})) {
      logger.warn('Rejected an unsigned Twilio callback', { path: req.path });
      res.status(403).end();
      return;
    }
    try {
      await handler(String(req.query.callId ?? ''), req.body ?? {});
    } catch (error) {
      logger.error('Twilio callback failed', { error: (error as Error).message });
    }
    res.status(204).end();
  };

router.post('/twilio/status', twilioHook((id, p) => calls.onStatus(id, p)));
router.post('/twilio/recording', twilioHook((id, p) => calls.onRecording(id, p)));

router.use(authenticate);

/** GET /calls/available — whether calls go through Poolora, so the app knows whether to dial directly */
router.get('/available', (req: Request, res: Response) => {
  sendSuccess(res, { masked: maskedCallsEnabled(), recorded: maskedCallsEnabled() && config.twilio.recordCalls }, 200, req.requestId);
});

/** POST /calls — { bookingId }: rings you, then connects you to the other person on the booking */
router.post(
  '/',
  validate({ body: Joi.object({ bookingId: Joi.string().hex().length(24).required() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await calls.start(req.body.bookingId, (req as AuthenticatedRequest).user.userId), 201, req.requestId);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
