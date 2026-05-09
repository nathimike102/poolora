import { Types } from 'mongoose';
import Razorpay from 'razorpay';
import { Booking, IBooking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { User } from '../models/User';
import { config } from '../config';
import { BookingStatus, RideStatus } from '../types';
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
import { WalletService } from './WalletService';

const walletService = new WalletService();

function getRazorpayClient(): Razorpay {
  if (!config.razorpay.keyId) {
    throw new AppError('Razorpay is not configured. Set RAZORPAY_KEY_ID in .env', 503, 'SERVICE_UNAVAILABLE');
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
  ): Promise<{ booking: IBooking; razorpayOrder: any; paidViaWallet?: boolean }> {
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
    let razorpayOrder: any = null;
    let paidViaWallet = false;

    if (data.useWallet) {
      // Wallet payment
      await walletService.deductForBooking(riderId, 'pending', estimatedFare);
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
      paidViaWallet = true;

      EventBridge.publish('booking-events', {
        eventType: 'booking.created',
        data: {
          bookingId: booking._id,
          rideId: data.rideId,
          riderId,
          driverId: ride.driver.toString(),
          paidViaWallet: true,
        },
      });

      return { booking, razorpayOrder: null, paidViaWallet };
    }

    // Default: create Razorpay order for pre-authorization
    razorpayOrder = await getRazorpayClient().orders.create({
      amount: Math.round(estimatedFare * 100), // Amount in paise
      currency: 'INR',
      receipt: `booking_${new Types.ObjectId()}`,
      notes: {
        rideId: data.rideId,
        riderId,
        driverId: ride.driver.toString(),
      },
    });

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

    booking.status = BookingStatus.CONFIRMED;
    await booking.save();

    // Decrease available seats
    await Ride.findByIdAndUpdate(
      booking.ride,
      { $inc: { availableSeats: -booking.seatsBooked } },
    );

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
    booking.cancelledBy = new Types.ObjectId(cancelledBy);
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

    // Refund to wallet if booking was paid via wallet (no razorpayOrderId)
    if (!booking.razorpayOrderId && originalStatus === BookingStatus.PENDING) {
      try {
        await walletService.refundToWallet(
          booking.rider.toString(),
          booking._id.toString(),
          booking.estimatedFare,
          reason,
        );
      } catch (refundError) {
        logger.error('Wallet refund failed after cancellation', {
          bookingId: booking._id,
          error: (refundError as Error).message,
        });
      }
    }

    // Initiate Razorpay refund if payment was captured
    if (booking.razorpayOrderId && booking.razorpayPaymentId) {
      try {
        const razorpay = getRazorpayClient();
        await (razorpay.payments as any).refund(booking.razorpayPaymentId, {
          amount: Math.round(booking.estimatedFare * 100), // paise
          notes: {
            bookingId: booking._id.toString(),
            reason,
            cancelledBy,
          },
        });
        logger.info('Razorpay refund initiated', {
          bookingId: booking._id,
          paymentId: booking.razorpayPaymentId,
          amount: booking.estimatedFare,
        });
      } catch (refundError) {
        logger.error('Razorpay refund failed after cancellation', {
          bookingId: booking._id,
          paymentId: booking.razorpayPaymentId,
          error: (refundError as Error).message,
        });
        // Non-fatal: log for manual follow-up, don't fail the cancellation
      }
    }

    EventBridge.publish('booking-events', {
      eventType: 'booking.cancelled',
      data: { bookingId: booking._id, cancelledBy, reason },
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
    const filter: any = { [role]: userId };
    if (status) filter.status = status;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('ride', 'pickup dropoff departureTime vehicle')
        .populate(role === 'rider' ? 'driver' : 'rider', 'name phone profilePhotoUrl')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filter),
    ]);

    return paginate(bookings, total, page, limit);
  }
}
