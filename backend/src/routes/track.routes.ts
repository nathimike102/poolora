import { Router } from 'express';
import { TrackingController } from '../controllers/TrackingController';

const router = Router();

// Public: the unguessable token in the SOS text message is the credential.
router.get('/sos/:token', TrackingController.sosPage);

export default router;
