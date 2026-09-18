import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/capability.middleware';
import { authRateLimit, otpRateLimit } from '../middlewares/rateLimit.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  submitKycSchema,
  kycReviewParamsSchema,
  rejectKycSchema,
} from '../validators';

const router = Router();

// Public
router.post('/send-otp', otpRateLimit, validate(sendOtpSchema), AuthController.sendOtp);
router.post('/verify-otp', authRateLimit, validate(verifyOtpSchema), AuthController.verifyOtp);
router.post('/refresh-token', authRateLimit, validate(refreshTokenSchema), AuthController.refreshToken);
router.post('/firebase-login', authRateLimit, AuthController.firebaseLogin);

// Protected
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.getMe);

// KYC
router.post('/kyc', authenticate, validate(submitKycSchema), AuthController.submitKyc);
router.post('/kyc/:userId/approve', authenticate, requireAdmin(), validate(kycReviewParamsSchema), AuthController.approveKyc);
router.post('/kyc/:userId/reject', authenticate, requireAdmin(), validate(rejectKycSchema), AuthController.rejectKyc);

export default router;
