import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/PaymentService';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const paymentService = new PaymentService();

export class PaymentWebhookController {
  /**
   * POST /api/v1/payments/webhook
   * Razorpay webhook handler. Validates HMAC signature.
   * Must receive raw body for signature verification.
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    // --- Signature validation (fail fast with proper HTTP codes) ---
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      return next(new AppError('Missing webhook signature', 400, 'INVALID_WEBHOOK'));
    }

    // Raw body is needed for HMAC verification
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const isValid = paymentService.validateWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn('Invalid Razorpay webhook signature received');
      return next(new AppError('Invalid webhook signature', 401, 'INVALID_SIGNATURE'));
    }

    // --- Event processing (always respond 200 so Razorpay does not retry) ---
    try {
      await paymentService.handleWebhookEvent(req.body);
      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('Webhook event processing error', { error });
      // Intentional: return 200 to prevent Razorpay from flooding with retries
      res.status(200).json({ status: 'error', message: 'Processing error logged' });
    }
  }

  /**
   * GET /api/v1/payments/history
   * Get payment history for authenticated user.
   */
  static async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const { role = 'rider', page = '1', limit = '20' } = req.query as any;
      const result = await paymentService.getUserPayments(
        user.userId,
        role,
        parseInt(page),
        parseInt(limit),
      );

      res.status(200).json({
        status: 'success',
        code: 200,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId,
      });
    } catch (error) {
      next(error);
    }
  }
}
