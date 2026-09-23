/**
 * Razorpay webhooks record what happened to a payment. They never confirm a
 * booking (the driver does, and that reserves the seats), and a failed attempt
 * never kills a booking the rider can still pay for or has already paid.
 */
jest.mock('../../models/Payment', () => ({
  Payment: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), create: jest.fn() },
}));
jest.mock('../../models/Booking', () => ({ Booking: { findOne: jest.fn(), findOneAndUpdate: jest.fn() } }));
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));

import { PaymentService } from '../../services/PaymentService';
import { Payment } from '../../models/Payment';
import { Booking } from '../../models/Booking';
import { EventBridge } from '../../events';
import { PaymentStatus } from '../../types';

const booking = { _id: 'booking1', rider: 'rider1', driver: 'driver1', estimatedFare: 300 };
const webhook = (event: string, extra: Record<string, unknown> = {}) => ({
  event,
  payload: {
    payment: {
      entity: { id: 'pay_1', order_id: 'order_1', amount: 30000, currency: 'INR', status: 'x', method: 'upi', ...extra },
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  (Booking.findOne as jest.Mock).mockResolvedValue(booking);
});

describe('payment.captured', () => {
  it('records the capture without confirming the booking', async () => {
    (Payment.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'p1' });

    await new PaymentService().handleWebhookEvent(webhook('payment.captured'));

    expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
      { razorpayOrderId: 'order_1' },
      { $set: { status: PaymentStatus.CAPTURED, razorpayPaymentId: 'pay_1' } },
      { new: true },
    );
    expect(Booking.findOneAndUpdate).not.toHaveBeenCalled();
    expect(EventBridge.publish).toHaveBeenCalledWith('payment-events', {
      eventType: 'payment.captured',
      data: expect.objectContaining({ bookingId: 'booking1', userId: 'rider1', amount: 300 }),
    });
  });

  it('creates the payment record when no authorization came first', async () => {
    (Payment.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

    await new PaymentService().handleWebhookEvent(webhook('payment.captured'));

    expect(Payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.CAPTURED, amount: 300, idempotencyKey: 'cap_order_1' }),
    );
  });
});

describe('payment.failed', () => {
  it('leaves the booking pending so the rider can retry', async () => {
    (Payment.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

    await new PaymentService().handleWebhookEvent(webhook('payment.failed', { error_description: 'Card declined' }));

    expect(Booking.findOneAndUpdate).not.toHaveBeenCalled();
    expect(EventBridge.publish).toHaveBeenCalledWith('payment-events', {
      eventType: 'payment.failed',
      data: expect.objectContaining({ bookingId: 'booking1', error: 'Card declined' }),
    });
  });

  it('never overwrites a payment that already went through', async () => {
    (Payment.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

    await new PaymentService().handleWebhookEvent(webhook('payment.failed'));

    expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
      {
        razorpayOrderId: 'order_1',
        status: { $nin: [PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED, PaymentStatus.REFUNDED] },
      },
      expect.anything(),
      { new: true },
    );
  });
});
