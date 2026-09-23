import { Router } from 'express';
import { DisputeController } from '../controllers/AdminWebController';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// A rider or driver disputes one of their bookings (UC-A04 step 1)
router.post('/', DisputeController.create);
router.get('/mine', DisputeController.mine);

export default router;
