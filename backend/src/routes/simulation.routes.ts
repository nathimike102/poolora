import { Router } from 'express';
import { SimulationController } from '../controllers/SimulationController';
import { authenticate } from '../middlewares/auth.middleware';

// Development-only ride simulator; the service refuses when it is turned off.
const router = Router();

router.use(authenticate);

router.get('/', SimulationController.status);
router.post('/as-rider', SimulationController.asRider);
router.post('/as-driver', SimulationController.asDriver);
router.post('/rides/:id/drive', SimulationController.drive);
router.post('/rides/:id/stop', SimulationController.stop);

export default router;
