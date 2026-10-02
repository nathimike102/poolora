import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { CompanyPortalService } from '../services/CompanyPortalService';

/**
 * A company's own dashboard (UC-C01 step 3), for its company admins. Every
 * call checks the caller is an admin of a company, and answers about that
 * company only.
 */
const router = Router();
const portal = new CompanyPortalService();
router.use(authenticate);

const handle = (fn: (req: Request, userId: string) => Promise<unknown>): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await fn(req, (req as AuthenticatedRequest).user.userId), 200, req.requestId);
    } catch (error) {
      next(error);
    }
  };

router.get('/me', handle((_req, userId) => portal.me(userId)));
router.get('/overview', handle((req, userId) => portal.overview(userId, req.query.month)));
router.get('/members', handle((_req, userId) => portal.members(userId)));
router.delete('/members/:userId', handle((req, userId) => portal.removeMember(userId, String(req.params.userId))));
router.get('/bills', handle((_req, userId) => portal.bills(userId)));
router.get('/bills/:id/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const file = await portal.billFile(userId, String(req.params.id), req.query.format === 'xlsx' ? 'xlsx' : 'pdf');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.status(200).send(file.body);
  } catch (error) {
    next(error);
  }
});

export default router;
