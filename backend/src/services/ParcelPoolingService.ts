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

const notificationService = new NotificationService();

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
    },
  ): Promise<{ parcel: IParcelPooling; razorpayOrder: Orders.RazorpayOrder; deliveryOtp: string }> {
    const ride = await Ride.findById(data.rideId);
    if (!ride) throw new NotFoundError('Ride');

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

    // Calculate estimated cost
    const basePrice = 50; // Base price in INR
    const pricePerKm = 5; // Price per km
    const distance = haversineDistanceKm(
      data.pickupLocation.lat,
      data.pickupLocation.lng,
      data.deliveryLocation.lat,
      data.deliveryLocation.lng,
    );
    const weightSurcharge = data.parcelWeight > 5 ? (data.parcelWeight - 5) * 10 : 0;
    const insuranceCost = data.insuranceValue ? data.insuranceValue * 0.01 : 0; // 1% insurance
    const estimatedCost = basePrice + distance * pricePerKm + weightSurcharge + insuranceCost;

    // Create Razorpay order
    const razorpay = getRazorpayClient();
    const razorpayOrder = await callRazorpay('create parcel order', () =>
      razorpay.orders.create({
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
      insuranceCost,
      specialInstructions: data.specialInstructions,
      trackingNumber,
      razorpayOrderId: razorpayOrder.id,
      deliveryOtpHash: hashOtp(deliveryOtp),
    });

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
    parcel.driverEarnings = parcel.estimatedCost * 0.7; // 70% to driver
    parcel.platformFee = parcel.estimatedCost * 0.3; // 30% platform fee
    await parcel.save();

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
  ): Promise<{ parcels: IParcelPooling[]; total: number }> {
    const query = role === 'sender' 
      ? { sender: userId } 
      : role === 'driver' 
        ? { driver: userId } 
        : { receiver: userId };

    const [parcels, total] = await Promise.all([
      ParcelPooling.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ride', 'pickup dropoff scheduledTime')
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

    parcel.status = BookingStatus.CANCELLED;
    parcel.cancelledBy = new Types.ObjectId(userId);
    parcel.cancellationReason = reason;
    parcel.cancelledAt = new Date();
    await parcel.save();

    EventBridge.publish('ride-events', {
      eventType: 'parcel:cancelled',
      data: { parcelId: parcel._id },
    });
    return parcel;
  }
}