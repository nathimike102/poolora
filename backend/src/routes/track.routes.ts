import { Router } from 'express';
import { TrackingController } from '../controllers/TrackingController';

const router = Router();

// Public: the unguessable token in the SOS text message is the credential.
router.get('/sos/:token', TrackingController.sosPage);
router.get('/trip/:token', TrackingController.tripPage);
// An emergency contact confirming by the link in their verification text (UC-R10)
router.get('/contact/:token', TrackingController.contactPage);
router.post('/contact/:token', TrackingController.confirmContact);

export default router;
