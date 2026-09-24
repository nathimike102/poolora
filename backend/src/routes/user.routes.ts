import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { idParamSchema, updateMeSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/me', UserController.getMe);
router.patch('/me', validate(updateMeSchema), UserController.updateMe);
router.get('/saved-routes', UserController.getSavedRoutes);
router.get('/kyc/status', UserController.getKYCStatus);
router.get('/me/statement', UserController.statement);
router.post('/me/statement/email', UserController.emailStatement);
router.get('/me/verified-status', UserController.verifiedStatus);
router.get('/:id', validate(idParamSchema), UserController.getUserProfile);

export default router;
