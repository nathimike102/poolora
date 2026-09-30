import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { SupportService } from '../services/SupportService';
import { SupportBotService, supportBotEnabled } from '../services/SupportBotService';
import { SUPPORT_CATEGORIES } from '../models/SupportTicket';
import { sendSuccess } from '../utils/helpers';
import type { AuthenticatedRequest } from '../types';

/** Help and support tickets (UC-X02) */
const router = Router();
const support = new SupportService();
const assistant = new SupportBotService();
router.use(authenticate);

const userId = (req: Request) => (req as AuthenticatedRequest).user.userId;
const idParam = { params: Joi.object({ id: Joi.string().hex().length(24).required() }) };

router.post(
  '/tickets',
  validate({
    body: Joi.object({
      category: Joi.string().valid(...SUPPORT_CATEGORIES).required(),
      subject: Joi.string().trim().min(3).max(120).required(),
      message: Joi.string().trim().min(10).max(4000).required(),
      bookingId: Joi.string().hex().length(24).optional(),
      appInfo: Joi.string().max(200).optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, { ticket: await support.create(userId(req), req.body) }, 201, req.requestId);
    } catch (error) {
      next(error);
    }
  },
);

router.get('/tickets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, { tickets: await support.mine(userId(req)) }, 200, req.requestId);
  } catch (error) {
    next(error);
  }
});

router.get('/tickets/:id', validate(idParam), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, { ticket: await support.get(userId(req), String(req.params.id)) }, 200, req.requestId);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/tickets/:id/reply',
  validate({ ...idParam, body: Joi.object({ text: Joi.string().trim().min(1).max(4000).required() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, { ticket: await support.reply(userId(req), String(req.params.id), req.body.text) }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  },
);

/** Whether the in-app assistant is switched on (it needs ANTHROPIC_API_KEY) */
router.get('/assistant', (req: Request, res: Response) => {
  sendSuccess(res, { enabled: supportBotEnabled() }, 200, req.requestId);
});

/** The conversation so far, oldest first, ending with the user's new message */
router.post(
  '/assistant',
  validate({
    body: Joi.object({
      messages: Joi.array()
        .items(Joi.object({ role: Joi.string().valid('user', 'assistant').required(), text: Joi.string().trim().min(1).max(4000).required() }))
        .min(1)
        .max(40)
        .required(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await assistant.reply(userId(req), req.body.messages), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
