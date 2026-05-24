import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
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

export default router;