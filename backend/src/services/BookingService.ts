import { Types } from 'mongoose';
import Razorpay from 'razorpay';
import { Booking, IBooking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { User } from '../models/User';
import { config } from '../config';
import { BookingStatus, PaymentStatus, RideStatus } from '../types';
import { Payment } from '../models/Payment';
import {
  AppError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from '../utils/AppError';
import { toGeoPoint, haversineDistanceKm, paginate } from '../utils/helpers';
import { MatchingEngineClient } from './MatchingEngineClient';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { callRazorpay } from '../utils/razorpay';
import { WalletService } from './WalletService';
import type { FilterQuery } from 'mongoose';
import type { Orders } from 'razorpay/dist/types/orders';

const walletService = new WalletService();

function getRazorpayClient(): Razorpay {
  if (!config.razorpay.keyId) {
    throw new AppError('Online payments are unavailable right now. Please pay from your wallet.', 503, 'SERVICE_UNAVAILABLE');
  }
  return new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });
}

export class BookingService {
  private matchingEngine = new MatchingEngineClient();

  /**
   * Create a booking request. Enforces:
   * - Max 3 pending requests per rider
   * - Pickup within 2km of route
   * - Creates Razorpay order for pre-authorization
   * - Optionally deducts from wallet if useWallet=true
   */
  async createBooking(
    riderId: string,
    data: {
      rideId: string;
      seatsBooked: number;
      pickup: { lng: number; lat: number; address: string };
      dropoff: { lng: number; lat: number; address: string };
      /** If true, pay from wallet balance instead of Razorpay */
      useWallet?: boolean;
    },
  ): Promise<{ booking: IBooking; razorpayOrder: Orders.RazorpayOrder | null; paidViaWallet?: boolean }> {
    const ride = await Ride.findById(data.rideId);
    if (!ride) throw new NotFoundError('Ride');

    // Cannot book own ride
    if (ride.driver.toString() === riderId) {
      throw new AppError('Cannot book your own ride', 400, 'SELF_BOOKING');
    }

    if (ride.status !== RideStatus.SCHEDULED && ride.status !== RideStatus.ACTIVE) {
      throw new ConflictError('Ride is not available for booking');
    }

    if (ride.availableSeats < data.seatsBooked) {
      throw new AppError(
        `Only ${ride.availableSeats} seats available`,
        400,
        'INSUFFICIENT_SEATS',
      );
    }

    // Check max pending requests per rider
    const pendingCount = await Booking.countDocuments({
      rider: riderId,
      status: BookingStatus.PENDING,
    });
    if (pendingCount >= config.ride.maxPendingRequestsPerRider) {
      throw new AppError(
        `Maximum ${config.ride.maxPendingRequestsPerRider} pending booking requests allowed`,
        400,
        'MAX_PENDING_BOOKINGS',
      );
    }

    // Check duplicate booking
    const existingBooking = await Booking.findOne({
      ride: data.rideId,
      rider: riderId,
      status: { $nin: [BookingStatus.CANCELLED, BookingStatus.REJECTED] },
    });
    if (existingBooking) {
      throw new ConflictError('You already have a booking for this ride');
    }

    // Validate pickup is within 2km of route start
    const pickupDistFromRoute = haversineDistanceKm(
      data.pickup.lat,
      data.pickup.lng,
      ride.pickup.location.coordinates[1],
      ride.pickup.location.coordinates[0],
    );
    if (pickupDistFromRoute > config.ride.maxPickupDistanceFromRouteKm) {
      throw new AppError(
        `Pickup location must be within ${config.ride.maxPickupDistanceFromRouteKm}km of the ride route`,
        400,
        'PICKUP_TOO_FAR',
      );
    }

    // Calculate estimated fare
    const estimatedFare = ride.pricePerSeat * data.seatsBooked;

    // Compute match score
    const rider = await User.findById(riderId);
    const driver = await User.findById(ride.driver);
    if (!rider || !driver) throw new NotFoundError('User');

    const [matchResult] = await this.matchingEngine.scoreRides(
      [{ ride, driver }],
      {
        pickupLng: data.pickup.lng,
        pickupLat: data.pickup.lat,
        dropoffLng: data.dropoff.lng,
        dropoffLat: data.dropoff.lat,
        departureTime: ride.departureTime,
      },
    );

    // ── Payment: wallet or Razorpay ──────────────────────────────────────────
    let razorpayOrder: Orders.RazorpayOrder | null = null;
    let paidViaWallet = false;

    if (data.useWallet) {
      // Wallet payment. Create the booking first so the debit is keyed to its
      // real id (one debit per booking), then roll back if the debit fails.
      const booking = await Booking.create({
        ride: data.rideId,
        rider: riderId,
        driver: ride.driver,
        status: BookingStatus.PENDING,
        seatsBooked: data.seatsBooked,
        pickup: {
          location: toGeoPoint(data.pickup.lng, data.pickup.lat),
          address: data.pickup.address,
        },
        dropoff: {
          location: toGeoPoint(data.dropoff.lng, data.dropoff.lat),
          address: data.dropoff.address,
        },
        estimatedFare,
        matchScore: matchResult?.overallScore || 0,
        // No razorpayOrderId — wallet paid
      });
      try {
        await walletService.deductForBooking(riderId, booking._id.toString(), estimatedFare);
      } catch (error) {
        await Booking.deleteOne({ _id: booking._id });
        throw error;
      }
      paidViaWallet = true;

      EventBridge.publish('booking-events', {
        eventType: 'booking.created',
        data: {
          bookingId: booking._id,
          rideId: data.rideId,
          riderId,
          driverId: ride.driver.toString(),
          seatsBooked: data.seatsBooked,
          paidViaWallet: true,
        },
      });

      return { booking, razorpayOrder: null, paidViaWallet };
    }

    // Default: create Razorpay order for pre-authorization
    razorpayOrder = await callRazorpay('create booking order', () =>
      getRazorpayClient().orders.create({
        amount: Math.round(estimatedFare * 100), // Amount in paise
        currency: 'INR',
        receipt: `booking_${new Types.ObjectId()}`,
        notes: {
          rideId: data.rideId,
          riderId,
          driverId: ride.driver.toString(),
        },
      }),
    );

    // Create booking
    const booking = await Booking.create({
      ride: data.rideId,
      rider: riderId,
      driver: ride.driver,
      status: BookingStatus.PENDING,
      seatsBooked: data.seatsBooked,
      pickup: {
        location: toGeoPoint(data.pickup.lng, data.pickup.lat),
        address: data.pickup.address,
      },
      dropoff: {
        location: toGeoPoint(data.dropoff.lng, data.dropoff.lat),
        address: data.dropoff.address,
      },
      estimatedFare,
      matchScore: matchResult?.overallScore || 0,
      razorpayOrderId: razorpayOrder.id,
    });

    EventBridge.publish('booking-events', {
      eventType: 'booking.created',
      data: {
        bookingId: booking._id,
        rideId: data.rideId,
        riderId,
        driverId: ride.driver.toString(),
        seatsBooked: data.seatsBooked,
      },
    });

    return { booking, razorpayOrder };
  }

  /**
   * Driver accepts/confirms a booking.
   */
  async confirmBooking(bookingId: string, driverId: string): Promise<IBooking> {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    if (booking.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the ride driver can confirm bookings');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictError('Booking is not in pending state');
    }

    // Card/UPI bookings can only be accepted once Razorpay has authorized the
    // payment (recorded by the signed webhook). Wallet bookings are paid upfront.
    if (booking.razorpayOrderId) {
      const paid = await Payment.exists({
        razorpayOrderId: booking.razorpayOrderId,
        status: { $in: [PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED] },
      });
      if (!paid) {
        throw new AppError('The rider has not completed payment for this booking yet', 409, 'PAYMENT_PENDING');
      }
    }

    // Reserve seats atomically so two confirmations can't overbook the ride
    const ride = await Ride.findOneAndUpdate(
      { _id: booking.ride, availableSeats: { $gte: booking.seatsBooked } },
      { $inc: { availableSeats: -booking.seatsBooked } },
      { new: true },
    );
    if (!ride) {
      throw new ConflictError('Not enough seats left on this ride to accept this booking');
    }

    booking.status = BookingStatus.CONFIRMED;
    await booking.save();

    EventBridge.publish('booking-events', {
      eventType: 'booking.confirmed',
      data: {
        bookingId: booking._id,
        riderId: booking.rider.toString(),
        driverId,
      },
    });

    return booking;
  }

  /**
   * Returns the rider's money for a booking that will not go ahead. Wallet
   * payments go back to the wallet; captured card/UPI payments are refunded
   * through Razorpay. Uncaptured authorizations are released by Razorpay
   * automatically. Failures are logged for manual follow-up rather than
   * blocking the cancellation.
   */
  async refundBooking(booking: IBooking, reason: string, actorId: string): Promise<void> {
    const amount = booking.estimatedFare;

    if (!booking.razorpayOrderId) {
      try {
        await walletService.refundToWallet(booking.rider.toString(), booking._id.toString(), amount, reason);
      } catch (refundError) {
        logger.error('Wallet refund failed; needs manual refund', {
          bookingId: booking._id,
          error: (refundError as Error).message,
        });
      }
      return;
    }

    const payment = await Payment.findOne({
      razorpayOrderId: booking.razorpayOrderId,
      status: { $in: [PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED] },
    });
    if (!payment) return; // never paid

    if (payment.status === PaymentStatus.AUTHORIZED) {
      logger.info('Uncaptured authorization will be released by Razorpay', { bookingId: booking._id });
      return;
    }

    if (!payment.razorpayPaymentId) {
      logger.error('Cannot refund: payment has no Razorpay payment id', { bookingId: booking._id });
      return;
    }

    try {
      await getRazorpayClient().payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(amount * 100), // paise
        notes: { bookingId: booking._id.toString(), reason, cancelledBy: actorId },
      });
      await Payment.updateOne({ _id: payment._id }, { $set: { status: PaymentStatus.REFUNDED } });
      logger.info('Razorpay refund initiated', { bookingId: booking._id, paymentId: payment.razorpayPaymentId, amount });
    } catch (refundError) {
      logger.error('Razorpay refund failed; needs manual refund', {
        bookingId: booking._id,
        paymentId: payment.razorpayPaymentId,
        error: (refundError as Error).message,
      });
    }
  }

  /**
   * Driver rejects a booking request.
   */
  async rejectBooking(bookingId: string, driverId: string, reason: string): Promise<IBooking> {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    if (booking.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the ride driver can reject bookings');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictError('Booking is not in pending state');
    }

    booking.status = BookingStatus.REJECTED;
    booking.cancellationReason = reason;
    await booking.save();

    // The rider paid upfront, so a declined request is refunded in full
    await this.refundBooking(booking, reason || 'Declined by driver', driverId);

    EventBridge.publish('booking-events', {
      eventType: 'booking.rejected',
      data: { bookingId: booking._id, riderId: booking.rider.toString() },
    });

    return booking;
  }

  /**
   * Rider or driver cancels a booking.
   */
  async cancelBooking(
    bookingId: string,
    cancelledBy: string,
    reason: string,
  ): Promise<IBooking> {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const isRider = booking.rider.toString() === cancelledBy;
    const isDriver = booking.driver.toString() === cancelledBy;
    if (!isRider && !isDriver) {
      throw new AuthorizationError('You are not part of this booking');
    }

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new ConflictError('Booking already cancelled or completed');
    }

    const originalStatus = booking.status;
    booking.status = BookingStatus.CANCELLED;
    booking.cancelledBy = Types.ObjectId.isValid(cancelledBy)
      ? new Types.ObjectId(cancelledBy)
      : undefined;
    booking.cancellationReason = reason;
    booking.cancelledAt = new Date();
    await booking.save();

    // Restore seats if booking was confirmed
    if (originalStatus === BookingStatus.CONFIRMED) {
      await Ride.findByIdAndUpdate(
        booking.ride,
        { $inc: { availableSeats: booking.seatsBooked } },
      );
    }

    await this.refundBooking(booking, reason, cancelledBy);

    EventBridge.publish('booking-events', {
      eventType: 'booking.cancelled',
      data: { bookingId: booking._id, riderId: booking.rider, cancelledBy, reason },
    });

    return booking;
  }

  /**
   * Complete a booking — calculate final fare, settle payment.
   */
  async completeBooking(bookingId: string, driverId: string): Promise<IBooking> {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    if (booking.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the driver can complete the booking');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictError('Booking must be confirmed to complete');
    }

    // Calculate final fare (in production, use actual distance/time)
    const finalFare = booking.estimatedFare;
    const platformFeeRate = config.ride.platformFeeRate;
    const platformFee = Math.round(finalFare * platformFeeRate * 100) / 100;
    const driverEarnings = finalFare - platformFee;

    booking.status = BookingStatus.COMPLETED;
    booking.finalFare = finalFare;
    booking.driverEarnings = driverEarnings;
    booking.platformFee = platformFee;
    booking.actualDropoffTime = new Date();
    await booking.save();

    // Update driver & rider stats
    await Promise.all([
      User.findByIdAndUpdate(driverId, {
        $inc: {
          'stats.totalRidesAsDriver': 1,
          'stats.totalEarnings': driverEarnings,
        },
      }),
      User.findByIdAndUpdate(booking.rider, {
        $inc: {
          'stats.totalRidesAsRider': 1,
          'stats.totalSpent': finalFare,
        },
      }),
    ]);

    EventBridge.publish('booking-events', {
      eventType: 'booking.completed',
      data: {
        bookingId: booking._id,
        finalFare,
        driverEarnings,
        platformFee,
      },
    });

    // ── Award coins to both rider and driver (non-fatal) ───────────────────────
    // Driver earns coins on their earnings; rider earns coins on fare spent.
    // Both calls are protected — a failure here never breaks booking completion.
    try {
      await Promise.allSettled([
        walletService.awardCoinsForRide(
          driverId,
          bookingId,
          driverEarnings,
        ),
        walletService.awardCoinsForRide(
          booking.rider.toString(),
          bookingId,
          finalFare,
        ),
      ]);
    } catch (coinError) {
      logger.error('Coin award failed after booking completion', {
        bookingId,
        error: (coinError as Error).message,
      });
    }

    return booking;
  }

  /**
   * Get bookings for a user (as rider or driver).
   */
  async getUserBookings(
    userId: string,
    role: 'rider' | 'driver',
    status: BookingStatus | undefined,
    page: number,
    limit: number,
  ) {
    const filter: FilterQuery<IBooking> = { [role]: userId };
    if (status) filter.status = status;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('ride', 'pickup dropoff departureTime vehicle totalSeats availableSeats pricePerSeat')
        .populate(
          role === 'rider' ? 'driver' : 'rider',
          role === 'rider'
            ? 'name phone profilePhotoUrl stats.avgRatingAsDriver stats.totalRatingsAsDriver stats.totalRidesAsDriver'
            : 'name phone profilePhotoUrl gender stats.avgRatingAsRider stats.totalRatingsAsRider stats.totalRidesAsRider',
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filter),
    ]);

    // Phone numbers are exchanged only for confirmed bookings.
    const counterpart = role === 'rider' ? 'driver' : 'rider';
    for (const booking of bookings) {
      const person = booking.get(counterpart) as { phone?: string } | null;
      if (booking.status !== BookingStatus.CONFIRMED && person && typeof person === 'object') {
        person.phone = undefined;
      }
    }

    return paginate(bookings, total, page, limit);
  }
}
