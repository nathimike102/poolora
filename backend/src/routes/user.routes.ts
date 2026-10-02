import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { closeAccountSchema, idParamSchema, updateMeSchema, identitySubmitSchema, linkTrackerSchema, vehicleParamSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/me', UserController.getMe);
router.patch('/me', validate(updateMeSchema), UserController.updateMe);
router.get('/saved-routes', UserController.getSavedRoutes);
router.get('/kyc/status', UserController.getKYCStatus);
router.get('/me/statement', UserController.statement);
router.post('/me/statement/email', UserController.emailStatement);
router.get('/me/verified-status', UserController.verifiedStatus);
router.get('/me/impact', UserController.impact);
router.get('/me/closure', UserController.closureCheck);
// Identity check for women-only rides
router.get('/me/identity', UserController.identityStatus);
// Car GPS trackers: link one by its device id (usually the IMEI)
router.get('/me/trackers', UserController.trackers);
router.put('/me/vehicles/:vehicleId/tracker', validate(linkTrackerSchema), UserController.linkTracker);
router.delete('/me/vehicles/:vehicleId/tracker', validate(vehicleParamSchema), UserController.unlinkTracker);
router.post('/me/identity', validate(identitySubmitSchema), UserController.submitIdentity);
router.delete('/me', validate(closeAccountSchema), UserController.closeAccount);
router.get('/:id', validate(idParamSchema), UserController.getUserProfile);

export default router;
