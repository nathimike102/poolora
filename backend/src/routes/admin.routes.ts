import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

/**
 * All admin routes require authentication and admin capability
 */
router.use(requireAuth(), requireAdmin());

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

export default router;