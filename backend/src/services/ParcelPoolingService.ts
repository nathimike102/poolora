import { Types } from 'mongoose';
import Razorpay from 'razorpay';
import { ParcelPooling, IParcelPooling } from '../models/ParcelPooling';
import { Ride } from '../models/Ride';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { config } from '../config';
import { BookingStatus, RideStatus } from '../types';
import {
  AppError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from '../utils/AppError';
import { toGeoPoint, haversineDistanceKm, generateTrackingNumber } from '../utils/helpers';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { NotificationService } from './NotificationService';

const notificationService = new NotificationService();

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
  ): Promise<{ parcel: IParcelPooling; razorpayOrder: any }> {
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
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(estimatedCost * 100), // Convert to paise
      currency: 'INR',
      receipt: `parcel_${Date.now()}`,
    });

    const trackingNumber = generateTrackingNumber();

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
    });

    logger.info('Parcel request created', {
      parcelId: parcel._id,
      senderId,
      trackingNumber,
    });

    // Emit event
    EventBridge.emit('parcel:created', {
      parcelId: parcel._id,
      rideId: data.rideId,
    });

    return { parcel, razorpayOrder };
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

    EventBridge.emit('parcel:accepted', {
      parcelId: parcel._id,
      driverId,
    });

    return parcel;
  }

  /**
   * Mark parcel as picked up
   */
  async pickupParcel(parcelId: string): Promise<IParcelPooling> {
    const parcel = await ParcelPooling.findById(parcelId);
    if (!parcel) throw new NotFoundError('Parcel');

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

    EventBridge.emit('parcel:picked_up', { parcelId: parcel._id });
    return parcel;
  }

  /**
   * Complete parcel delivery
   */
  async completeDelivery(
    parcelId: string,
    proof: {
      signature: string;
      photo?: string;
      otp?: string;
    },
  ): Promise<IParcelPooling> {
    const parcel = await ParcelPooling.findById(parcelId);
    if (!parcel) throw new NotFoundError('Parcel');

    if (parcel.status !== BookingStatus.CONFIRMED) {
      throw new ConflictError('Parcel must be in transit');
    }

    parcel.actualDeliveryTime = new Date();
    parcel.proof = proof;
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

    EventBridge.emit('parcel:completed', { parcelId: parcel._id });
    return parcel;
  }

  /**
   * Get parcel by tracking number
   */
  async getParcelByTracking(trackingNumber: string): Promise<IParcelPooling> {
    const parcel = await ParcelPooling.findOne({
      trackingNumber,
    })
      .populate('sender', 'name phone profilePicture')
      .populate('driver', 'name phone profilePicture vehicle')
      .populate('receiver', 'name phone profilePicture');

    if (!parcel) throw new NotFoundError('Parcel');
    return parcel;
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
    const query = role === 'sender' ? { sender: userId } : { driver: userId };

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

    EventBridge.emit('parcel:cancelled', { parcelId: parcel._id });
    return parcel;
  }
}