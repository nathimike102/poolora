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
  contactIdParamSchema,
  idParamSchema,
  paginationSchema,
  rideCheckInSchema,
  sosDetailsSchema,
} from '../validators';

const router = Router();

router.use(authenticate);

// Active incidents — Admin — MUST be before /:id
router.get('/sos/active', requireAdmin(), validate(paginationSchema), SafetyController.getActiveIncidents);

// Emergency contacts (user)
router.get('/emergency-contacts', SafetyController.getEmergencyContacts);
router.put('/emergency-contacts', validate(emergencyContactsSchema), SafetyController.updateEmergencyContacts);
router.post('/emergency-contacts/:contactId/verify', validate(contactIdParamSchema), SafetyController.verifyEmergencyContact);

// The caller's open SOS, or the booking one would be about (the SOS screen opens with this)
router.get('/sos/current', SafetyController.getCurrent);

// SOS status
router.get('/sos/:id', validate(idParamSchema), SafetyController.getSOSStatus);

// User SOS actions
router.post('/sos', validate(triggerSOSSchema), SafetyController.triggerSOS);
// In-ride "Are you OK?" answers (UC-R05)
router.post('/ride-check-in', validate(rideCheckInSchema), SafetyController.rideCheckIn);
router.post('/sos/:id/location', validate(sosLocationSchema), SafetyController.updateSOSLocation);
router.post('/sos/:id/evidence', validate(sosEvidenceSchema), SafetyController.addEvidence);
// "What's happening?": who or what the danger is, after the alert has gone
router.post('/sos/:id/details', validate(sosDetailsSchema), SafetyController.details);
// Audio during an SOS, when the user has switched it on (uploaded in chunks)
router.post('/sos/:id/audio-upload', validate(idParamSchema), SafetyController.audioUpload);
// Live video for the safety team (UC-X04): turn the camera on, say it is sending, turn it off
router.post('/sos/:id/video', validate(idParamSchema), SafetyController.startVideo);
router.post('/sos/:id/video/sending', validate(idParamSchema), SafetyController.videoSending);
router.post('/sos/:id/video/stop', validate(idParamSchema), SafetyController.stopVideo);
router.post('/sos/:id/check-in', validate(sosCheckInSchema), SafetyController.updateSOSCheckIn);
// Cancel an accidental SOS before emergency contacts are texted (UC-R07 3a)
router.post('/sos/:id/cancel', validate(idParamSchema), SafetyController.cancelSOS);

// Admin SOS actions
router.post('/sos/:id/acknowledge', requireAdmin(), validate(idParamSchema), SafetyController.acknowledgeSOS);
router.post('/sos/:id/resolve', requireAdmin(), validate(idParamSchema), SafetyController.resolveSOS);
router.post('/sos/:id/notify-police', requireAdmin(), validate(idParamSchema), SafetyController.notifyPolice);

export default router;
