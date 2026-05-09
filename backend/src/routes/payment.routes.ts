import { Router } from 'express';
import { PaymentWebhookController } from '../controllers/PaymentWebhookController';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Webhook — NO auth middleware (Razorpay calls this)
router.post('/webhook', PaymentWebhookController.handleWebhook);

// Payment history — authenticated
router.get('/history', authenticate, PaymentWebhookController.getPaymentHistory);

export default router;
