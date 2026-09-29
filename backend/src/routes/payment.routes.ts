import { Router } from 'express';
import { PaymentWebhookController as P } from '../controllers/PaymentWebhookController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { startChargeSchema } from '../validators';

const router = Router();

// Paynow calls these: no auth. The result is verified by its hash.
router.post('/paynow/result', P.paynowResult);
router.get('/paynow/return', P.paynowReturn);

router.get('/options', authenticate, P.options);
router.post('/start', authenticate, validate(startChargeSchema), P.start);
router.get('/charges/:reference', authenticate, P.chargeStatus);

// Payment history — authenticated
router.get('/history', authenticate, P.getPaymentHistory);

export default router;
