import crypto from 'crypto';
import { Types } from 'mongoose';
import Razorpay from 'razorpay';
import type { Orders } from 'razorpay/dist/types/orders';
import { ParcelPooling, IParcelPooling } from '../models/ParcelPooling';
import { Ride } from '../models/Ride';
import { config } from '../config';
import { BookingStatus, UserCapability } from '../types';
import {
  AppError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from '../utils/AppError';
import { toGeoPoint, haversineDistanceKm, generateTrackingNumber, generateOTP } from '../utils/helpers';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { callRazorpay } from '../utils/razorpay';
import { NotificationService } from './NotificationService';
import { WalletService } from './WalletService';
import { User } from '../models/User';
import { RideStatus } from '../types';
import { money } from '../config/region';

const notificationService = new NotificationService();
const walletService = new WalletService();
const round2 = (n: number) => Math.round(n * 100) / 100;
/** The driver's share of a delivered parcel; the rest is the platform fee */
const DRIVER_SHARE = 0.7;

const MAX_DELIVERY_OTP_ATTEMPTS = 5;

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function getRazorpayClient(): Razorpay {
  if (!config.razorpay.keyId) {
    throw new AppError('Razorpay is not configured', 503, 'SERVICE_UNAVAILABLE');
  }
  return new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });
}

/** What sending a parcel costs: US$2, 8 cents a km, 50 cents a kg over 5 kg, and 1% of any insured value */
export function parcelCost(input: { pickup: { lat: number; lng: number }; delivery: { lat: number; lng: number }; weightKg: number; insuranceValue?: number }) {
  const distanceKm = haversineDistanceKm(input.pickup.lat, input.pickup.lng, input.delivery.lat, input.delivery.lng);
  const weightSurcharge = input.weightKg > 5 ? (input.weightKg - 5) * 0.5 : 0;
  const insuranceCost = input.insuranceValue ? input.insuranceValue * 0.01 : 0;
  return {
    distanceKm: round2(distanceKm),
    insuranceCost: round2(insuranceCost),
    total: round2(2 + distanceKm * 0.08 + weightSurcharge + insuranceCost),
  };
}

export class ParcelPoolingService {
  /**
   * Create a parcel pooling request
   */
  async createParcelRequest(
    senderId: string,
    data: {
      rideId: string;
      parcelWeight: number;
      parcelType: 'document' | 'fragile' | 'perishable' | 'general';
      parcelDimensions?: { length: number; width: number; height: number };
      pickupLocation: {
        lng: number;
        lat: number;
        address: string;
        contactPerson: string;
        contactPhone: string;
      };
      deliveryLocation: {
        lng: number;
        lat: number;
        address: string;
        contactPerson: string;
        contactPhone: string;
      };
      estimatedDeliveryTime: Date;
      insuranceValue?: number;
      specialInstructions?: string;
      receiverId?: string;
      /** Pay from the wallet instead of by card or UPI */
      useWallet?: boolean;
    },
  ): Promise<{ parcel: IParcelPooling; razorpayOrder: Orders.RazorpayOrder | null; deliveryOtp: string }> {
    const ride = await Ride.findById(data.rideId);
    if (!ride) throw new NotFoundError('Ride');
    if (ride.driver.toString() === senderId) {
      throw new AppError('You cannot send a parcel on your own ride', 409, 'SELF_PARCEL');
    }
    if (![RideStatus.SCHEDULED, RideStatus.ACTIVE].includes(ride.status) || ride.departureTime.getTime() <= Date.now()) {
      throw new AppError('This ride has already left or is no longer available', 409, 'RIDE_NOT_AVAILABLE');
    }

    // Validate parcel weight doesn't exceed vehicle capacity
    const totalParcelWeight = await ParcelPooling.aggregate([
      {
        $match: {
          ride: new Types.ObjectId(data.rideId),
          status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
      },
      { $group: { _id: null, totalWeight: { $sum: '$parcelWeight' } } },
    ]);

    const currentWeight = totalParcelWeight[0]?.totalWeight || 0;
    if (currentWeight + data.parcelWeight > 100) {
      // Max 100kg per vehicle
      throw new AppError('Parcel weight exceeds vehicle capacity', 400, 'WEIGHT_EXCEEDED');
    }

    const cost = parcelCost({ pickup: data.pickupLocation, delivery: data.deliveryLocation, weightKg: data.parcelWeight, insuranceValue: data.insuranceValue });
    const estimatedCost = cost.total;
    const insuranceCost = cost.insuranceCost;

    // Card or UPI: a Razorpay order the app pays; the webhook records the payment
    const razorpayOrder = data.useWallet
      ? null
      : await callRazorpay('create parcel order', () =>
        getRazorpayClient().orders.create({
          amount: Math.round(estimatedCost * 100), // Convert to paise
          currency: 'INR',
          receipt: `parcel_${Date.now()}`,
        }),
      );

    const trackingNumber = generateTrackingNumber();
    // Shown once to the sender, who shares it with the recipient. The driver
    // must enter it to complete delivery.
    const deliveryOtp = generateOTP();

    const parcel = await ParcelPooling.create({
      ride: data.rideId,
      sender: senderId,
      receiver: data.receiverId,
      driver: ride.driver,
      status: BookingStatus.PENDING,
      parcelWeight: data.parcelWeight,
      parcelType: data.parcelType,
      parcelDimensions: data.parcelDimensions,
      pickupLocation: {
        location: toGeoPoint(data.pickupLocation.lng, data.pickupLocation.lat),
        address: data.pickupLocation.address,
        contactPerson: data.pickupLocation.contactPerson,
        contactPhone: data.pickupLocation.contactPhone,
      },
      deliveryLocation: {
        location: toGeoPoint(data.deliveryLocation.lng, data.deliveryLocation.lat),
        address: data.deliveryLocation.address,
        contactPerson: data.deliveryLocation.contactPerson,
        contactPhone: data.deliveryLocation.contactPhone,
      },
      estimatedDeliveryTime: data.estimatedDeliveryTime,
      estimatedCost,
      insuranceValue: data.insuranceValue,
      insuranceCost: round2(insuranceCost),
      specialInstructions: data.specialInstructions,
      trackingNumber,
      razorpayOrderId: razorpayOrder?.id,
      paymentMethod: data.useWallet ? 'wallet' : 'razorpay',
      deliveryOtpHash: hashOtp(deliveryOtp),
    });

    if (data.useWallet) {
      // Keyed to the parcel's id, so it is charged once; undone if the wallet is short
      try {
        await walletService.deductForBooking(senderId, parcel._id.toString(), estimatedCost);
      } catch (error) {
        await ParcelPooling.deleteOne({ _id: parcel._id });
        throw error;
      }
      parcel.paymentStatus = 'paid';
      parcel.paidAt = new Date();
      await parcel.save();
    }

    logger.info('Parcel request created', {
      parcelId: parcel._id,
      senderId,
      trackingNumber,
    });

    // Publish event
    EventBridge.publish('ride-events', {
      eventType: 'parcel:created',
      data: {
        parcelId: parcel._id,
        rideId: data.rideId,
      },
    });

    return { parcel, razorpayOrder, deliveryOtp };
  }

  /**
   * Accept parcel delivery request
   */
  async acceptParcelRequest(parcelId: string, driverId: string): Promise<IParcelPooling> {
    const parcel = await ParcelPooling.findById(parcelId);
    if (!parcel) throw new NotFoundError('Parcel');

    if (parcel.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the assigned driver can accept');
    }

    if (parcel.status !== BookingStatus.PENDING) {
      throw new ConflictError('Parcel is not pending acceptance');
    }
    if (parcel.paymentStatus !== 'paid' && parcel.paymentStatus !== 'authorized') {
      throw new AppError('The sender has not paid for this parcel yet', 409, 'PARCEL_NOT_PAID');
    }

    parcel.status = BookingStatus.CONFIRMED;
    await parcel.save();

    // Notify sender
    await notificationService.createNotification(
      parcel.sender.toString(),
      'Parcel Accepted',
      `Your parcel has been accepted by the driver. Tracking: ${parcel.trackingNumber}`,
      'system',
      { parcelId: parcel._id.toString(), trackingNumber: parcel.trackingNumber },
    );

    EventBridge.publish('ride-events', {
      eventType: 'parcel:accepted',
      data: {
        parcelId: parcel._id,
        driverId,
      },
    });

    return parcel;
  }

  /**
   * Mark parcel as picked up
   */
  async pickupParcel(parcelId: string, driverId: string): Promise<IParcelPooling> {
    const parcel = await ParcelPooling.findById(parcelId);
    if (!parcel) throw new NotFoundError('Parcel');

    if (parcel.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the assigned driver can pick up this parcel');
    }

    if (parcel.status !== BookingStatus.CONFIRMED) {
      throw new ConflictError('Parcel must be confirmed before pickup');
    }
    if (parcel.actualPickupTime) throw new ConflictError('The parcel has already been picked up');
    // Photo proof at pickup (UC-P03)
    await new (await import('./ParcelEvidenceService')).ParcelEvidenceService().requirePhoto(parcel, 'pickup');

    parcel.actualPickupTime = new Date();
    await parcel.save();

    // Notify sender and receiver
    const notificationTitle = 'Parcel Picked Up';
    const notificationBody = `Your parcel has been picked up. Tracking: ${parcel.trackingNumber}`;

    await Promise.all([
      notificationService.createNotification(
        parcel.sender.toString(),
        notificationTitle,
        notificationBody,
        'system',
      ),
      parcel.receiver &&
      notificationService.createNotification(
        parcel.receiver.toString(),
        'Parcel On the Way',
        notificationBody,
        'system',
      ),
    ]);

    EventBridge.publish('ride-events', {
      eventType: 'parcel:picked_up',
      data: { parcelId: parcel._id },
    });
    return parcel;
  }

  /**
   * Complete parcel delivery
   */
  async completeDelivery(
    parcelId: string,
    driverId: string,
    proof: {
      signature: string;
      photo?: string;
      otp: string;
    },
  ): Promise<IParcelPooling> {
    const parcel = await ParcelPooling.findById(parcelId).select('+deliveryOtpHash +deliveryOtpAttempts');
    if (!parcel) throw new NotFoundError('Parcel');

    if (parcel.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the assigned driver can complete this delivery');
    }

    if (parcel.status !== BookingStatus.CONFIRMED || !parcel.actualPickupTime) {
      throw new ConflictError('Parcel must be picked up before delivery');
    }

    if (!parcel.deliveryOtpHash) {
      throw new AppError('This parcel has no delivery code', 409, 'DELIVERY_OTP_MISSING');
    }
    await new (await import('./ParcelEvidenceService')).ParcelEvidenceService().requirePhoto(parcel, 'delivery');

    if ((parcel.deliveryOtpAttempts ?? 0) >= MAX_DELIVERY_OTP_ATTEMPTS) {
      throw new AppError(
        'Too many incorrect delivery codes. Contact support to complete this delivery.',
        429,
        'DELIVERY_OTP_LOCKED',
      );
    }

    const expected = Buffer.from(parcel.deliveryOtpHash, 'hex');
    const provided = Buffer.from(hashOtp(proof.otp), 'hex');
    if (!crypto.timingSafeEqual(expected, provided)) {
      await ParcelPooling.updateOne({ _id: parcel._id }, { $inc: { deliveryOtpAttempts: 1 } });
      throw new AppError('Incorrect delivery code', 400, 'INVALID_DELIVERY_OTP');
    }

    parcel.actualDeliveryTime = new Date();
    parcel.proof = { signature: proof.signature, photo: proof.photo };
    parcel.deliveryOtpHash = undefined;
    parcel.status = BookingStatus.COMPLETED;
    parcel.finalCost = parcel.estimatedCost;
    parcel.driverEarnings = round2(parcel.estimatedCost * DRIVER_SHARE);
    parcel.platformFee = round2(parcel.estimatedCost - parcel.driverEarnings);
    await parcel.save();
    // Counted with the driver's ride earnings
    await User.findByIdAndUpdate(driverId, { $inc: { 'stats.totalEarnings': parcel.driverEarnings } });

    // Notify all parties
    const notificationTitle = 'Parcel Delivered';
    const notificationBody = `Your parcel has been delivered. Tracking: ${parcel.trackingNumber}`;

    await Promise.all([
      notificationService.createNotification(
        parcel.sender.toString(),
        notificationTitle,
        notificationBody,
        'system',
      ),
      parcel.receiver &&
      notificationService.createNotification(
        parcel.receiver.toString(),
        notificationTitle,
        notificationBody,
        'system',
      ),
    ]);

    EventBridge.publish('ride-events', {
      eventType: 'parcel:completed',
      data: { parcelId: parcel._id },
    });
    return parcel;
  }

  /**
   * Get parcel by tracking number
   */
  async getParcelByTracking(
    trackingNumber: string,
    viewer: { userId: string; capabilities: UserCapability[] },
  ): Promise<IParcelPooling> {
    const parcel = await ParcelPooling.findOne({ trackingNumber });

    // Contact details are only for the people involved in the delivery. Anyone
    // else gets the same response as an unknown tracking number.
    const participants = [parcel?.sender, parcel?.driver, parcel?.receiver]
      .filter(Boolean)
      .map(String);
    const canView =
      parcel &&
      (participants.includes(viewer.userId) || viewer.capabilities.includes(UserCapability.ADMIN));
    if (!parcel || !canView) throw new NotFoundError('Parcel');

    return parcel.populate([
      { path: 'sender', select: 'name phone profilePicture' },
      { path: 'driver', select: 'name phone profilePicture vehicle' },
      { path: 'receiver', select: 'name phone profilePicture' },
    ]);
  }

  /**
   * List parcels for user
   */
  async listUserParcels(
    userId: string,
    role: 'sender' | 'driver' | 'receiver',
    skip = 0,
    limit = 20,
    /** Only parcels on this ride, for the driver's ride screen */
    rideId?: string,
  ): Promise<{ parcels: IParcelPooling[]; total: number }> {
    const query: Record<string, unknown> = role === 'sender'
      ? { sender: userId }
      : role === 'driver'
        ? { driver: userId }
        : { receiver: userId };
    if (rideId) query.ride = rideId;
    // Drivers see a request only once it is paid
    if (role === 'driver') query.paymentStatus = { $in: ['authorized', 'paid', 'refunded', 'refund_failed'] };

    const [parcels, total] = await Promise.all([
      ParcelPooling.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ride', 'pickup.address dropoff.address departureTime status')
        .populate('driver', 'name phone profilePicture'),
      ParcelPooling.countDocuments(query),
    ]);

    return { parcels, total };
  }

  /**
   * Cancel parcel
   */
  async cancelParcel(
    parcelId: string,
    userId: string,
    reason: string,
  ): Promise<IParcelPooling> {
    const parcel = await ParcelPooling.findById(parcelId);
    if (!parcel) throw new NotFoundError('Parcel');

    // Only sender or admin can cancel
    if (parcel.sender.toString() !== userId) {
      throw new AuthorizationError('Only the sender can cancel');
    }

    if (parcel.status === BookingStatus.COMPLETED || parcel.status === BookingStatus.CANCELLED) {
      throw new ConflictError('Cannot cancel completed or already cancelled parcel');
    }
    if (parcel.actualPickupTime) {
      throw new AppError('The driver already has the parcel. Contact support to stop the delivery.', 409, 'PARCEL_PICKED_UP');
    }

    return this.cancelAndRefund(parcel, userId, reason);
  }

  /** The driver turns down a parcel request; the sender is refunded in full */
  async rejectParcelRequest(parcelId: string, driverId: string, reason = 'The driver could not take this parcel'): Promise<IParcelPooling> {
    const parcel = await ParcelPooling.findById(parcelId);
    if (!parcel) throw new NotFoundError('Parcel');
    if (parcel.driver.toString() !== driverId) throw new AuthorizationError('Only the assigned driver can decline');
    if (parcel.status !== BookingStatus.PENDING) throw new ConflictError('Parcel is not pending acceptance');
    const cancelled = await this.cancelAndRefund(parcel, driverId, reason);
    await notificationService.createNotification(
      parcel.sender.toString(),
      'Parcel request declined',
      `The driver could not take your parcel. ${cancelled.refundAmount ? `${money(cancelled.refundAmount)} is on its way back to you.` : ''}`.trim(),
      'system',
      { parcelId: parcel._id.toString() },
    );
    return cancelled;
  }

  /** Cancels a parcel that has not been picked up, and returns the sender's money */
  private async cancelAndRefund(parcel: IParcelPooling, actorId: string, reason: string): Promise<IParcelPooling> {
    parcel.status = BookingStatus.CANCELLED;
    parcel.cancelledBy = new Types.ObjectId(actorId);
    parcel.cancellationReason = reason;
    parcel.cancelledAt = new Date();

    if (parcel.paymentStatus === 'paid') {
      const amount = parcel.estimatedCost;
      try {
        if (parcel.paymentMethod === 'wallet') {
          await walletService.refundToWallet(parcel.sender.toString(), parcel._id.toString(), amount, reason);
        } else if (parcel.razorpayPaymentId) {
          await getRazorpayClient().payments.refund(parcel.razorpayPaymentId, {
            amount: Math.round(amount * 100),
            notes: { parcelId: parcel._id.toString(), reason },
          });
        } else {
          throw new Error('No Razorpay payment id');
        }
        parcel.paymentStatus = 'refunded';
        parcel.refundAmount = amount;
      } catch (error) {
        logger.error('Parcel refund failed; needs manual refund', { parcelId: parcel._id, error: (error as Error).message });
        parcel.paymentStatus = 'refund_failed';
      }
    }
    // An authorization that was never captured is released by Razorpay
    await parcel.save();

    EventBridge.publish('ride-events', {
      eventType: 'parcel:cancelled',
      data: { parcelId: parcel._id },
    });
    return parcel;
  }

  /**
   * Records a card or UPI payment for a parcel from the Razorpay webhook.
   * Returns false when the order is not a parcel's.
   */
  async recordRazorpayPayment(orderId: string, paymentId: string, captured: boolean): Promise<boolean> {
    const parcel = await ParcelPooling.findOne({ razorpayOrderId: orderId });
    if (!parcel) return false;
    if (parcel.paymentStatus === 'paid' || parcel.paymentStatus === 'refunded') return true;
    parcel.razorpayPaymentId = paymentId;
    parcel.paymentStatus = captured ? 'paid' : 'authorized';
    parcel.paidAt ??= new Date();
    await parcel.save();
    if (parcel.status === BookingStatus.PENDING) {
      await notificationService
        .createNotification(parcel.driver.toString(), 'New parcel request', `A parcel is waiting for you to accept. Tracking: ${parcel.trackingNumber}`, 'ride', { parcelId: parcel._id.toString() })
        .catch(() => undefined);
    }
    return true;
  }
}