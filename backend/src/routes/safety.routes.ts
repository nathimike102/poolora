import { Router } from 'express';
import { SafetyController } from '../controllers/SafetyController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/capability.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  triggerSOSSchema,
  sosCheckInSchema,
  sosLocationSchema,
  sosEvidenceSchema,
  emergencyContactsSchema,
  idParamSchema,
  paginationSchema,
} from '../validators';

const router = Router();

router.use(authenticate);

// Active incidents — Admin — MUST be before /:id
router.get('/sos/active', requireAdmin(), validate(paginationSchema), SafetyController.getActiveIncidents);

// Emergency contacts (user)
router.get('/emergency-contacts', SafetyController.getEmergencyContacts);
router.put('/emergency-contacts', validate(emergencyContactsSchema), SafetyController.updateEmergencyContacts);

// SOS status
router.get('/sos/:id', validate(idParamSchema), SafetyController.getSOSStatus);

// User SOS actions
router.post('/sos', validate(triggerSOSSchema), SafetyController.triggerSOS);
router.post('/sos/:id/location', validate(sosLocationSchema), SafetyController.updateSOSLocation);
router.post('/sos/:id/evidence', validate(sosEvidenceSchema), SafetyController.addEvidence);
router.post('/sos/:id/check-in', validate(sosCheckInSchema), SafetyController.updateSOSCheckIn);

// Admin SOS actions
router.post('/sos/:id/acknowledge', requireAdmin(), validate(idParamSchema), SafetyController.acknowledgeSOS);
router.post('/sos/:id/resolve', requireAdmin(), validate(idParamSchema), SafetyController.resolveSOS);
router.post('/sos/:id/notify-police', requireAdmin(), validate(idParamSchema), SafetyController.notifyPolice);

export default router;
