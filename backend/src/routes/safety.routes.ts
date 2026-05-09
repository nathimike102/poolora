import { Router } from 'express';
import { SafetyController } from '../controllers/SafetyController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/capability.middleware';
import { validate } from '../middlewares/validation.middleware';
import { triggerSOSSchema } from '../validators';

const router = Router();

router.use(authenticate);

// Active incidents — Admin — MUST be before /:id
router.get('/sos/active', requireAdmin(), SafetyController.getActiveIncidents);

// User SOS actions
router.post('/sos', validate(triggerSOSSchema), SafetyController.triggerSOS);
router.post('/sos/:id/location', SafetyController.updateSOSLocation);
router.post('/sos/:id/evidence', SafetyController.addEvidence);

// Admin SOS actions
router.post('/sos/:id/acknowledge', requireAdmin(), SafetyController.acknowledgeSOS);
router.post('/sos/:id/resolve', requireAdmin(), SafetyController.resolveSOS);

export default router;
