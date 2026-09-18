import { Router } from 'express';
import { AdminController, getKycDocuments } from '../controllers/AdminController';
import { validate } from '../middlewares/validation.middleware';
import { kycReviewParamsSchema } from '../validators';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/capability.middleware';

const router = Router();

/**
 * All admin routes require authentication and admin capability
 */
router.use(authenticate, requireAdmin());

/**
 * GET /api/v1/admin/metrics
 * Get system metrics
 */
router.get('/metrics', AdminController.getMetrics);

/**
 * GET /api/v1/admin/rides
 * Get all rides
 */
router.get('/rides', AdminController.getRides);

/**
 * GET /api/v1/admin/users
 * Get all users
 */
router.get('/users', AdminController.getUsers);

/**
 * GET /api/v1/admin/payments
 * Get payments
 */
router.get('/payments', AdminController.getPayments);

/**
 * GET /api/v1/admin/demand-heatmap
 * Get demand clusters
 */
router.get('/demand-heatmap', AdminController.getDemandHeatmap);

/**
 * GET /admin/kyc/:userId/documents
 * Temporary links to review a driver's KYC documents
 */
router.get('/kyc/:userId/documents', validate(kycReviewParamsSchema), getKycDocuments);

export default router;