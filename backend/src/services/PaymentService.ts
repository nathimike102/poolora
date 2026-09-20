import crypto from 'crypto';
import mongoose from 'mongoose';
import { Payment } from '../models/Payment';
import { Booking } from '../models/Booking';
import { config } from '../config';
import { PaymentStatus, BookingStatus } from '../types';

import { logger } from '../utils/logger';
import { EventBridge } from '../events';
import type { FilterQuery } from 'mongoose';
import type { IPayment } from '../models/Payment';
import { PaymentMethod } from '../types';

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
        error_code?: string;
        error_description?: string;
        notes?: Record<string, string>;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        receipt: string;
      };
    };
  };
}

export class PaymentService {
  /**
   * Validate Razorpay webhook HMAC signature.
   */
  /**
   * Verifies the HMAC over the exact bytes Razorpay sent. Takes the raw Buffer
   * where we have it: re-serialising the parsed body can change byte order or
   * spacing and would fail a signature that is in fact valid.
   */
  validateWebhookSignature(body: string | Buffer, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(body)
      .digest('hex');

    if (signature.length !== expectedSignature.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }

  /**
   * Process a Razorpay webhook event.
   * Maintains idempotency using the gateway orderId.
   */
  async handleWebhookEvent(payload: RazorpayWebhookPayload): Promise<void> {
    const event = payload.event;
    logger.info('Processing Razorpay webhook', { event });

    switch (event) {
      case 'payment.authorized':
        await this.handlePaymentAuthorized(payload);
        break;
      case 'payment.captured':
        await this.handlePaymentCaptured(payload);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(payload);
        break;
      default:
        logger.info('Unhandled Razorpay webhook event', { event });
    }
  }

  private async handlePaymentAuthorized(
    payload: RazorpayWebhookPayload,
  ): Promise<void> {
    const paymentEntity = payload.payload.payment!.entity;
    const orderId = paymentEntity.order_id;
    const idempotencyKey = `auth_${orderId}`;

    // Idempotency check
    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) {
      logger.info('Duplicate payment.authorized webhook', { orderId });
      return;
    }

    const booking = await Booking.findOne({ razorpayOrderId: orderId });
    if (!booking) {
      logger.error('Booking not found for Razorpay order', { orderId });
      return;
    }

    const amount = paymentEntity.amount / 100; // Convert from paise
    const platformCommissionRate = config.ride.platformFeeRate;
    const platformCommission = Math.round(amount * platformCommissionRate * 100) / 100;
    const driverPayout = amount - platformCommission;

    await Payment.create({
      booking: booking._id,
      rider: booking.rider,
      driver: booking.driver,
      amount,
      currency: paymentEntity.currency,
      status: PaymentStatus.AUTHORIZED,
      method: paymentEntity.method as PaymentMethod,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentEntity.id,
      driverPayout,
      platformCommission,
      platformCommissionRate,
      idempotencyKey,
    });

    EventBridge.publish('payment-events', {
      eventType: 'payment.authorized',
      data: { orderId, bookingId: booking._id, amount },
    });
  }

  private async handlePaymentCaptured(
    payload: RazorpayWebhookPayload,
  ): Promise<void> {
    const paymentEntity = payload.payload.payment!.entity;
    const orderId = paymentEntity.order_id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update payment record
      const payment = await Payment.findOneAndUpdate(
        { razorpayOrderId: orderId },
        {
          $set: {
            status: PaymentStatus.CAPTURED,
            razorpayPaymentId: paymentEntity.id,
          },
        },
        { session, new: true },
      );

      if (!payment) {
        // Payment wasn't previously authorized — create it
        const booking = await Booking.findOne({ razorpayOrderId: orderId });
        if (!booking) {
          logger.error('Booking not found for captured payment', { orderId });
          await session.abortTransaction();
          return;
        }

        const amount = paymentEntity.amount / 100;
        const platformCommissionRate = config.ride.platformFeeRate;
        const platformCommission = Math.round(amount * platformCommissionRate * 100) / 100;

        await Payment.create(
          [{
            booking: booking._id,
            rider: booking.rider,
            driver: booking.driver,
            amount,
            currency: paymentEntity.currency,
            status: PaymentStatus.CAPTURED,
            method: paymentEntity.method,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentEntity.id,
            driverPayout: amount - platformCommission,
            platformCommission,
            platformCommissionRate,
            idempotencyKey: `cap_${orderId}`,
          }],
          { session },
        );
      }

      // Confirm the booking via ACID transaction
      await Booking.findOneAndUpdate(
        { razorpayOrderId: orderId, status: BookingStatus.PENDING },
        { $set: { status: BookingStatus.CONFIRMED } },
        { session },
      );

      await session.commitTransaction();

      EventBridge.publish('payment-events', {
        eventType: 'payment.captured',
        data: { orderId, paymentId: paymentEntity.id },
      });
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error processing payment.captured', { error, orderId });
      throw error;
    } finally {
      session.endSession();
    }
  }

  private async handlePaymentFailed(
    payload: RazorpayWebhookPayload,
  ): Promise<void> {
    const paymentEntity = payload.payload.payment!.entity;
    const orderId = paymentEntity.order_id;

    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: orderId },
      {
        $set: {
          status: PaymentStatus.FAILED,
          failureReason: paymentEntity.error_description || 'Payment failed',
        },
      },
      { new: true }
    );
    
    const booking = await Booking.findOneAndUpdate(
      { razorpayOrderId: orderId },
      { $set: { status: BookingStatus.PAYMENT_FAILED } },
      { new: true }
    );

    if (booking) {
      EventBridge.publish('payment-events', {
        eventType: 'payment.failed',
        data: {
          orderId,
          bookingId: booking._id,
          userId: booking.rider,
          amount: payment?.amount || booking.estimatedFare || 0,
          error: paymentEntity.error_description || 'Payment failed',
          paymentId: paymentEntity.id,
        },
      });
    }
  }

  /**
   * Get payment history for a user.
   */
  async getUserPayments(
    userId: string,
    role: 'rider' | 'driver',
    page: number,
    limit: number,
  ) {
    const filter: FilterQuery<IPayment> = { [role]: userId };

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('booking', 'ride seatsBooked')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    return { payments, total, page, limit };
  }
}
