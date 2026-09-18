import { Router } from 'express';
import { UploadController } from '../controllers/UploadController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { presignKycUploadSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.post('/kyc', validate(presignKycUploadSchema), UploadController.presignKyc);

export default router;
