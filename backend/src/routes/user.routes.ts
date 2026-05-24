import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/me', UserController.getMe);
router.get('/saved-routes', UserController.getSavedRoutes);
router.post('/kyc/submit', UserController.submitKYC);
router.get('/kyc/status', UserController.getKYCStatus);
router.get('/:id', UserController.getUserProfile);

export default router;
