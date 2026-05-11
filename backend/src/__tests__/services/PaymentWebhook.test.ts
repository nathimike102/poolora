/**
 * Tests for PaymentWebhookController
 * Covers Razorpay webhook signature validation and event processing.
 */

import { Request, Response, NextFunction } from 'express';
import { PaymentWebhookController } from '../../controllers/PaymentWebhookController';
import { PaymentService } from '../../services/PaymentService';

jest.mock('../../services/PaymentService');

describe('PaymentWebhookController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('handleWebhook', () => {
    it('should reject request without signature header', async () => {
      mockReq = {
        headers: {},
        body: { event: 'payment.captured' },
      };

      await PaymentWebhookController.handleWebhook(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Missing webhook signature',
        }),
      );
    });

    it('should reject request with invalid signature', async () => {
      mockReq = {
        headers: { 'x-razorpay-signature': 'invalid-sig' },
        body: { event: 'payment.captured' },
      };

      const mockValidate = jest.fn().mockReturnValue(false);
      (PaymentService.prototype.validateWebhookSignature as jest.Mock) = mockValidate;

      // Re-import to pick up mock
      jest.isolateModules(async () => {
        const { PaymentWebhookController: Controller } = require('../../controllers/PaymentWebhookController');
        await Controller.handleWebhook(
          mockReq as Request,
          mockRes as Response,
          mockNext,
        );
      });

      // The main module level test
      await PaymentWebhookController.handleWebhook(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 200 for valid webhook with captured event', async () => {
      const webhookBody = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              order_id: 'order_456',
              amount: 50000,
              status: 'captured',
            },
          },
        },
      };

      mockReq = {
        headers: { 'x-razorpay-signature': 'valid-signature-hash' },
        body: webhookBody,
        rawBody: JSON.stringify(webhookBody),
      } as any;

      // Mock the payment service methods
      const paymentServiceInstance = new PaymentService();
      jest.spyOn(paymentServiceInstance, 'validateWebhookSignature').mockReturnValue(true);
      jest.spyOn(paymentServiceInstance, 'handleWebhookEvent').mockResolvedValue(undefined);

      // Since the controller creates its own instance, we need to mock at module level
      jest.spyOn(PaymentService.prototype, 'validateWebhookSignature').mockReturnValue(true);
      jest.spyOn(PaymentService.prototype, 'handleWebhookEvent').mockResolvedValue(undefined);

      await PaymentWebhookController.handleWebhook(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('should return 200 even when processing fails (prevent Razorpay retries)', async () => {
      const webhookBody = {
        event: 'payment.failed',
        payload: { payment: { entity: { id: 'pay_fail' } } },
      };

      mockReq = {
        headers: { 'x-razorpay-signature': 'valid-sig' },
        body: webhookBody,
      } as any;

      jest.spyOn(PaymentService.prototype, 'validateWebhookSignature').mockReturnValue(true);
      jest.spyOn(PaymentService.prototype, 'handleWebhookEvent').mockRejectedValue(
        new Error('DB connection lost'),
      );

      await PaymentWebhookController.handleWebhook(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      // Must still return 200 to prevent retry flood
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' }),
      );
    });
  });

  describe('getPaymentHistory', () => {
    it('should return paginated payment history', async () => {
      const mockPayments = [
        { _id: 'pay1', amount: 500, status: 'captured' },
        { _id: 'pay2', amount: 300, status: 'captured' },
      ];

      jest.spyOn(PaymentService.prototype, 'getUserPayments').mockResolvedValue({
        payments: mockPayments as any,
        total: 2,
        page: 1,
        limit: 20,
      });

      mockReq = {
        user: { userId: 'user123' },
        query: { role: 'rider', page: '1', limit: '20' },
      } as any;

      await PaymentWebhookController.getPaymentHistory(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            payments: expect.arrayContaining([
              expect.objectContaining({ _id: 'pay1' }),
            ]),
          }),
        }),
      );
    });
  });
});
