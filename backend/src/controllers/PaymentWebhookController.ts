import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/PaymentService';
import { ChargeService } from '../services/ChargeService';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/helpers';
import { logger } from '../utils/logger';
import { queryInt, queryString } from '../utils/request';

const paymentService = new PaymentService();
const charges = new ChargeService();

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export class PaymentWebhookController {
  /**
   * POST /payments/paynow/result
   * Paynow's status update: a URL-encoded form, verified by its hash. The raw
   * body is kept (see app.ts) so values are read in the order Paynow sent
   * them. Always answers 200 so Paynow does not keep retrying; a message that
   * fails verification is logged and ignored.
   */
  static async paynowResult(req: Request, res: Response): Promise<void> {
    try {
      const body = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
      const ok = await charges.handleResult(body);
      res.status(200).send(ok ? 'OK' : 'IGNORED');
    } catch (error) {
      logger.error('Paynow result processing error', { error: (error as Error).message });
      res.status(200).send('ERROR');
    }
  }

  /**
   * GET /payments/paynow/return
   * Where Paynow sends a card payer afterwards. The app checks the payment
   * itself, so this only says what to do next.
   */
  static paynowReturn(req: Request, res: Response): void {
    const reference = escapeHtml(queryString(req, 'reference', '') ?? '');
    res
      .status(200)
      .type('html')
      .send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Poolora payment</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#1a1a1a;line-height:1.5}h1{font-size:22px}p{color:#55544f}</style></head>
<body><h1>Thank you</h1><p>Go back to the Poolora app. It will show your payment as soon as Paynow confirms it, usually within a minute.</p>${reference ? `<p style="font-size:13px">Reference ${reference}</p>` : ''}</body></html>`);
  }

  /** GET /payments/options: currencies and methods available now */
  static options(req: Request, res: Response): void {
    sendSuccess(res, charges.options(), 200, req.requestId);
  }

  /** POST /payments/start: start paying for a booking, parcel or top-up */
  static async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
      const charge = await charges.start(req.user.userId, req.body);
      sendSuccess(res, { charge }, 201, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /** GET /payments/charges/:reference: where a payment stands */
  static async chargeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
      const charge = await charges.status(req.user.userId, String(req.params.reference));
      sendSuccess(res, { charge }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /payments/history
   * Get payment history for authenticated user.
   */
  static async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
      }
      const role = queryString(req, 'role', 'rider') === 'driver' ? 'driver' : 'rider';
      const page = queryInt(req, 'page', 1);
      const limit = queryInt(req, 'limit', 20);
      const result = await paymentService.getUserPayments(user.userId, role, page, limit);

      res.status(200).json({
        status: 'success',
        code: 200,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
}
