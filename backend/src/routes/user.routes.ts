import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { closeAccountSchema, idParamSchema, updateMeSchema, identitySubmitSchema, linkTrackerSchema, vehicleParamSchema, pushTokenSchema, profilePhotoSchema, phoneCodeSchema, confirmPhoneSchema } from '../validators';
import { otpRateLimit, verifyRateLimit } from '../middlewares/rateLimit.middleware';

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
router.put('/me/push-token', validate(pushTokenSchema), UserController.savePushToken);
router.put('/me/photo', validate(profilePhotoSchema), UserController.setPhoto);
router.delete('/me/photo', UserController.removePhoto);
// Adding or changing the phone number, proved with a code
router.post('/me/phone/code', otpRateLimit, validate(phoneCodeSchema), UserController.sendPhoneCode);
router.put('/me/phone', verifyRateLimit, validate(confirmPhoneSchema), UserController.confirmPhone);
router.delete('/me/push-token', validate(pushTokenSchema), UserController.removePushToken);
router.get('/me/work', UserController.work);
router.post('/me/work', UserController.joinWork);
router.delete('/me/work', UserController.leaveWork);
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
