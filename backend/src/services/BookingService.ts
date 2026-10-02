import { Types } from 'mongoose';
import { Booking, IBooking } from '../models/Booking';
import { Ride, rideRoutePath } from '../models/Ride';
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
import { toGeoPoint, paginate } from '../utils/helpers';
import { nearestOnPath } from '../utils/routeGeometry';
import { MatchingEngineClient } from './MatchingEngineClient';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { WalletService } from './WalletService';
import { CarbonService } from './CarbonService';
import { NotificationService } from './NotificationService';
import { isVerifiedWoman, womenOnlyRefusal } from './IdentityService';
import type { FilterQuery } from 'mongoose';
import { phrase } from '../i18n';
import { activeOrganisationOf, colleaguesOf } from './OrganisationService';
import { companyContribution } from './OrganisationService';
import { riderPays } from '../utils/fares';

const walletService = new WalletService();
const carbonService = new CarbonService();

/**
 * What a refund did: credited the wallet (all, or only the part still
 * refundable), found nothing paid, or failed and needs a manual refund.
 * Online payments come back to the wallet too, since Paynow has no refund
 * API; the rider can withdraw them to mobile money.
 */
export type RefundOutcome = 'wallet' | 'partial' | 'none' | 'failed';

/**
 * Until when a rider may cancel a confirmed booking for everything back:
 * riderFreeCancelMins after the driver accepted, and only while the ride is
 * at least riderFreeCancelLeadMins away. Null when there is no such window.
 */
export function freeCancelUntil(departureTime: Date, confirmedAt?: Date): Date | null {
  if (!confirmedAt) return null;
  const graceEnds = confirmedAt.getTime() + config.ride.riderFreeCancelMins * 60_000;
  const leadEnds = departureTime.getTime() - config.ride.riderFreeCancelLeadMins * 60_000;
  const until = Math.min(graceEnds, leadEnds);
  return until > confirmedAt.getTime() ? new Date(until) : null;
}

/** Share of the fare a rider gets back for cancelling a confirmed booking. */
export function riderRefundRate(departureTime: Date, now = new Date(), confirmedAt?: Date): number {
  const free = freeCancelUntil(departureTime, confirmedAt);
  if (free && now.getTime() <= free.getTime()) return 1;
  const hoursLeft = (departureTime.getTime() - now.getTime()) / 3_600_000;
  const tier = config.ride.riderCancellationRefunds.find((t) => hoursLeft >= t.minHours);
  return tier ? tier.refundRate : 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * How a cancelled fare splits: what goes back to the rider, and what the
 * platform and the driver keep of the rest. `byPolicy` is true when the rider
 * cancelled a confirmed seat and the tiered policy applies; then, with
 * keepPlatformFeeOnCancel on, the platform fee on the whole fare is kept.
 */
export function cancellationSplit(fare: number, refundRate: number, byPolicy: boolean) {
  const fullFee = round2(fare * config.ride.platformFeeRate);
  let refund = round2(fare * refundRate);
  if (byPolicy && config.ride.keepPlatformFeeOnCancel) refund = Math.min(refund, round2(fare - fullFee));
  const retained = round2(fare - refund);
  const platformFee = byPolicy && config.ride.keepPlatformFeeOnCancel
    ? Math.min(fullFee, retained)
    : round2(retained * config.ride.platformFeeRate);
  return { refund, retained, platformFee, driverEarnings: round2(retained - platformFee) };
}

/** Wrong pickup codes before only the rider can confirm the pickup */
export const PICKUP_PIN_MAX_TRIES = 5;

export class BookingService {
  private matchingEngine = new MatchingEngineClient();

  /**
   * Create a booking request. Enforces:
   * - Max 3 pending requests per rider
   * - Pickup within 2km of route
   * - Pays from the wallet when useWallet is set; otherwise the request
   *   waits for an online payment (ChargeService) before the driver can accept
   */
  async createBooking(
    riderId: string,
    data: {
      rideId: string;
      seatsBooked: number;
      pickup: { lng: number; lat: number; address: string };
      dropoff: { lng: number; lat: number; address: string };
      /** If true, pay from wallet balance instead of online (EcoCash, OneMoney, InnBucks, card) */
      useWallet?: boolean;
      /** Optional message to the driver (UC-R03 step 6) */
      note?: string;
    },
  ): Promise<{ booking: IBooking; paidViaWallet: boolean }> {
    const ride = await Ride.findById(data.rideId);
    if (!ride) throw new NotFoundError('Ride');

    // Cannot book own ride
    if (ride.driver.toString() === riderId) {
      throw new AppError('Cannot book your own ride', 400, 'SELF_BOOKING');
    }

    // Search hides women-only rides from everyone else; a ride id alone must not get round it
    if (ride.preferences?.womenOnly) {
      const rider = await User.findById(riderId).select('gender identity').lean();
      if (!isVerifiedWoman(rider)) throw womenOnlyRefusal(rider);
    }
    // Search hides colleagues-only rides from other companies; a ride id must not get round that either
    if (ride.preferences?.colleaguesOnly) {
      const company = await activeOrganisationOf(riderId);
      if (!company || String(company._id) !== String(ride.organisation)) {
        throw new AppError('This ride is only for the driver\'s colleagues.', 403, 'COLLEAGUES_ONLY');
      }
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

    // Riders may join and leave part-way, so both ends are measured against
    // the whole route (UC-R03), and the pickup must come before the drop
    const path = rideRoutePath(ride);
    const maxKm = config.ride.maxPickupDistanceFromRouteKm;
    const boarding = nearestOnPath({ lat: data.pickup.lat, lng: data.pickup.lng }, path);
    const leaving = nearestOnPath({ lat: data.dropoff.lat, lng: data.dropoff.lng }, path);
    if (boarding.distanceKm > maxKm) {
      throw new AppError(`Pickup location must be within ${maxKm}km of the ride route`, 400, 'PICKUP_TOO_FAR');
    }
    if (leaving.distanceKm > maxKm) {
      throw new AppError(`Drop location must be within ${maxKm}km of the ride route`, 400, 'DROPOFF_TOO_FAR');
    }
    if (leaving.alongKm <= boarding.alongKm) {
      throw new AppError('This ride goes the other way: your drop comes before your pickup on its route', 400, 'WRONG_DIRECTION');
    }

    // Calculate estimated fare, and what the rider's company pays of it (UC-C01)
    const estimatedFare = ride.pricePerSeat * data.seatsBooked;
    const rider = await User.findById(riderId);
    const driver = await User.findById(ride.driver);
    if (!rider || !driver) throw new NotFoundError('User');
    const company = await companyContribution({
      riderId, rider, fare: estimatedFare, departure: ride.departureTime, pickup: data.pickup, dropoff: data.dropoff,
    });
    const companyFields = company && company.share > 0
      ? { companyShare: company.share, organisation: company.organisation, companyMonth: company.month }
      : {};
    const youPay = riderPays({ estimatedFare, companyShare: company?.share });

    // Compute match score

    const [matchResult] = await this.matchingEngine.scoreRides(
      [{ ride, driver, pickupDistanceKm: boarding.distanceKm }],
      {
        pickupLng: data.pickup.lng,
        pickupLat: data.pickup.lat,
        dropoffLng: data.dropoff.lng,
        dropoffLat: data.dropoff.lat,
        departureTime: ride.departureTime,
      },
    );

    // ── Payment: wallet now, or online next ─────────────────────────────────

    // Nothing to charge when the company pays it all: it goes the wallet way with no debit
    if (data.useWallet || youPay <= 0) {
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
        ...companyFields,
        matchScore: matchResult?.overallScore || 0,
        note: data.note?.trim() || undefined,
        paymentMethod: 'wallet',
      });
      try {
        if (youPay > 0) await walletService.deductForBooking(riderId, booking._id.toString(), youPay);
      } catch (error) {
        await Booking.deleteOne({ _id: booking._id });
        throw error;
      }

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

      return { booking, paidViaWallet: true };
    }

    // Online: the app starts the payment next (POST /payments/start)
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
      ...companyFields,
      matchScore: matchResult?.overallScore || 0,
      note: data.note?.trim() || undefined,
      paymentMethod: 'online',
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

    return { booking, paidViaWallet: false };
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

    // Online bookings can only be accepted once Paynow reports them paid
    // (ChargeService records the payment). Wallet bookings are paid upfront.
    if (booking.paymentMethod === 'online') {
      const paid = await Payment.exists({ booking: booking._id, status: PaymentStatus.CAPTURED });
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
    booking.confirmedAt = new Date();
    await booking.save();

    EventBridge.publish('booking-events', {
      eventType: 'booking.confirmed',
      data: {
        bookingId: booking._id,
        riderId: booking.rider.toString(),
        driverId,
      },
    });

    // Requests that no longer fit are turned down now rather than left
    // waiting for seats that are gone (UC-D03 5a)
    const overflow = await Booking.find({
      ride: booking.ride,
      status: BookingStatus.PENDING,
      seatsBooked: { $gt: ride.availableSeats },
    }).select('_id');
    for (const { _id } of overflow) {
      await this.expireBooking(_id.toString(), BookingStatus.REJECTED, 'The ride is now full');
    }

    return booking;
  }

  /**
   * Closes a pending request without the driver or rider acting: the ride
   * filled up, the driver did not answer, or the rider never paid. Anything
   * already paid is refunded in full. The status update is conditional on the
   * request still being pending, so it cannot race a driver accepting it.
   * Returns false when the request had already moved on.
   */
  async expireBooking(
    bookingId: string,
    status: BookingStatus.REJECTED | BookingStatus.CANCELLED,
    reason: string,
  ): Promise<boolean> {
    const booking = await Booking.findOneAndUpdate(
      { _id: bookingId, status: BookingStatus.PENDING },
      { $set: { status, cancellationReason: reason, cancelledAt: new Date() } },
      { new: true },
    );
    if (!booking) return false;

    await this.refundBooking(booking, reason, 'system');

    EventBridge.publish('booking-events', {
      eventType: 'booking.expired',
      data: { bookingId: booking._id, riderId: booking.rider.toString(), status, reason },
    });
    return true;
  }

  /**
   * Returns the rider's money for a booking that will not go ahead, to their
   * wallet: wallet payments straight back, and online payments too, since
   * Paynow cannot refund. Online refunds are capped at what is still
   * refundable on the payment. Failures are logged for manual follow-up
   * rather than blocking the cancellation. `amount` defaults to the whole fare.
   */
  async refundBooking(
    booking: IBooking,
    reason: string,
    _actorId: string,
    amount: number = riderPays(booking),
    /** A dispute passes its own, so it is not deduplicated against a cancellation refund */
    walletIdempotencyKey?: string,
  ): Promise<RefundOutcome> {
    if (amount <= 0) return 'none';
    const rider = booking.rider.toString();

    if (booking.paymentMethod !== 'online') {
      try {
        await walletService.refundToWallet(rider, booking._id.toString(), amount, reason, walletIdempotencyKey);
        return 'wallet';
      } catch (refundError) {
        logger.error('Wallet refund failed; needs manual refund', { bookingId: booking._id, error: (refundError as Error).message });
        return 'failed';
      }
    }

    const payment = await Payment.findOne({ booking: booking._id, status: { $in: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED] } });
    if (!payment) return 'none'; // never paid

    const alreadyRefunded = payment.refundAmount ?? 0;
    const refundable = Math.round((payment.amount - alreadyRefunded) * 100) / 100;
    const toRefund = Math.min(amount, refundable);
    if (toRefund <= 0) {
      logger.error('Nothing left to refund on this payment; needs manual review', { bookingId: booking._id, amount });
      return 'failed';
    }

    try {
      await walletService.refundToWallet(rider, booking._id.toString(), toRefund, reason, walletIdempotencyKey);
      const refundedTotal = Math.round((alreadyRefunded + toRefund) * 100) / 100;
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            refundAmount: refundedTotal,
            refundReason: reason,
            // Only a full refund marks the payment refunded; a partial one stays captured
            status: refundedTotal >= payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.CAPTURED,
          },
        },
      );
      logger.info('Online payment refunded to wallet', { bookingId: booking._id, reference: payment.reference, amount: toRefund });
      return toRefund < amount ? 'partial' : 'wallet';
    } catch (refundError) {
      logger.error('Refund to wallet failed; needs manual refund', { bookingId: booking._id, reference: payment.reference, error: (refundError as Error).message });
      return 'failed';
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
    const ride = originalStatus === BookingStatus.CONFIRMED
      ? await Ride.findByIdAndUpdate(booking.ride, { $inc: { availableSeats: booking.seatsBooked } })
      : null;

    // A rider cancelling a confirmed seat gets back a share that shrinks as
    // departure nears (UC-R09), or everything just after the driver accepted;
    // the rest goes to the driver, less the platform fee (UC-D04 7b).
    // Requests not yet accepted, and anything the driver cancels, are
    // refunded in full.
    // Full refund when the driver moved the departure after this booking was made (UC-D08)
    const byPolicy = Boolean(isRider && ride && !booking.rideChangedAt);
    const split = cancellationSplit(riderPays(booking), byPolicy ? riderRefundRate(ride!.departureTime, new Date(), booking.confirmedAt) : 1, byPolicy);
    const refundAmount = split.refund;
    const cancellationFee = split.retained;
    booking.refundAmount = refundAmount;
    booking.cancellationFee = cancellationFee;
    if (cancellationFee > 0) {
      booking.platformFee = split.platformFee;
      booking.driverEarnings = split.driverEarnings;
      if (split.driverEarnings > 0) {
        await User.findByIdAndUpdate(booking.driver, {
          $inc: { 'stats.totalEarnings': booking.driverEarnings },
        });
      }
    }
    await booking.save();

    await this.refundBooking(booking, reason, cancelledBy, refundAmount);

    EventBridge.publish('booking-events', {
      eventType: 'booking.cancelled',
      data: { bookingId: booking._id, riderId: booking.rider, cancelledBy, reason, refundAmount },
    });

    return booking;
  }

  /**
   * What the rider would get back for cancelling now, so the app can show the
   * policy before they confirm.
   */
  async getCancellationQuote(bookingId: string, userId: string) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    const isRider = booking.rider.toString() === userId;
    if (!isRider && booking.driver.toString() !== userId) {
      throw new AuthorizationError('You are not part of this booking');
    }
    let refundRate = 1;
    let byPolicy = false;
    let freeUntil: Date | null = null;
    if (isRider && booking.status === BookingStatus.CONFIRMED && !booking.rideChangedAt) {
      const ride = await Ride.findById(booking.ride).select('departureTime');
      if (ride) {
        const now = new Date();
        refundRate = riderRefundRate(ride.departureTime, now, booking.confirmedAt);
        byPolicy = true;
        freeUntil = freeCancelUntil(ride.departureTime, booking.confirmedAt);
        if (freeUntil && freeUntil.getTime() < now.getTime()) freeUntil = null;
      }
    }
    // The rider's own part: a cancelled trip costs the company nothing
    const paid = riderPays(booking);
    const { refund: refundAmount, platformFee } = cancellationSplit(paid, refundRate, byPolicy);
    const feeKept = byPolicy && config.ride.keepPlatformFeeOnCancel;
    return {
      fare: paid,
      refundAmount,
      refundPercent: paid ? Math.round((refundAmount / paid) * 100) : 0,
      /** The platform fee kept from this cancellation when the fee is non-refundable */
      platformFeeKept: feeKept ? platformFee : 0,
      platformFeeRefundable: !config.ride.keepPlatformFeeOnCancel,
      /** Cancelling before this gets everything back; absent once the window has passed */
      freeCancelUntil: freeUntil ?? undefined,
      policy: config.ride.riderCancellationRefunds.map((t) => ({
        minHoursBeforeDeparture: t.minHours,
        refundPercent: Math.round(t.refundRate * 100),
      })),
      freeCancelMins: config.ride.riderFreeCancelMins,
    };
  }

  /**
   * The driver is at this rider's pickup (UC-D04 step 4). Starts the
   * no-show wait (UC-D07) and tells the rider.
   */
  async markArrived(bookingId: string, driverId: string): Promise<IBooking> {
    const booking = await this.driverBookingOnRideUnderWay(bookingId, driverId);
    if (booking.actualPickupTime) throw new ConflictError('This rider has already been picked up');
    if (!booking.driverArrivedAt) {
      booking.driverArrivedAt = new Date();
      await booking.save();
      EventBridge.publish('booking-events', {
        eventType: 'booking.driver_arrived',
        data: { bookingId: booking._id, riderId: booking.rider.toString(), waitMins: config.ride.noShowWaitMins },
      });
    }
    return booking;
  }

  /** The rider is in the car (UC-D04 step 5). */
  /**
   * The driver confirms the rider is in the car with the rider's 4-digit
   * pickup code, so a rider never gets into the wrong car. Five wrong codes
   * lock it: then only the rider can confirm, in their own app. The
   * simulator skips the code.
   */
  async markPickedUp(bookingId: string, driverId: string, pin?: string, options: { simulation?: boolean } = {}): Promise<IBooking> {
    const booking = await this.driverBookingOnRideUnderWay(bookingId, driverId, '+pickupPin +pickupPinAttempts');
    if (booking.actualPickupTime) return booking;

    if (booking.pickupPin && !options.simulation) {
      const tries = booking.pickupPinAttempts ?? 0;
      if (tries >= PICKUP_PIN_MAX_TRIES) {
        throw new AppError('Too many wrong codes. Ask the rider to tap "I\'m in the car" in their app.', 409, 'PICKUP_PIN_LOCKED');
      }
      const given = typeof pin === 'string' ? pin.replace(/\D/g, '') : '';
      if (given !== booking.pickupPin) {
        booking.pickupPinAttempts = tries + 1;
        await booking.save();
        const left = PICKUP_PIN_MAX_TRIES - booking.pickupPinAttempts;
        if (!left) await this.pickupPinLocked(booking);
        throw new AppError(
          given ? `That is not the rider's code.${left ? ` ${left} ${left === 1 ? 'try' : 'tries'} left.` : ' Ask the rider to confirm in their app.'}` : 'Ask the rider for their 4-digit pickup code',
          422,
          left ? 'WRONG_PICKUP_PIN' : 'PICKUP_PIN_LOCKED',
        );
      }
    }
    return this.recordPickup(booking, options.simulation ? 'simulation' : booking.pickupPin ? 'pin' : undefined);
  }

  /**
   * The rider confirms they are in the car, from their own app: the way in
   * when the code cannot be exchanged, or after five wrong codes.
   */
  async riderConfirmsPickup(bookingId: string, riderId: string): Promise<IBooking> {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    if (booking.rider.toString() !== riderId) throw new AuthorizationError('Only the rider can confirm this');
    if (booking.status !== BookingStatus.CONFIRMED) throw new ConflictError('This booking is not active');
    const ride = await Ride.findById(booking.ride).select('status');
    if (ride?.status !== RideStatus.IN_PROGRESS) throw new ConflictError('The ride has not started');
    if (booking.actualPickupTime) return booking;
    return this.recordPickup(booking, 'rider');
  }

  /** `by` is absent for bookings made before pickup codes */
  private async recordPickup(booking: IBooking, by?: 'pin' | 'rider' | 'simulation'): Promise<IBooking> {
    booking.actualPickupTime = new Date();
    booking.driverArrivedAt ??= booking.actualPickupTime;
    booking.driverConfirmedPickup = true;
    booking.pickupConfirmedBy = by;
    booking.safetyCheck = { missed: 0 };
    await booking.save();
    EventBridge.publish('booking-events', {
      eventType: 'booking.picked_up',
      data: { bookingId: booking._id, riderId: booking.rider.toString() },
    });
    return booking;
  }

  /** Five wrong codes: the rider is told to check the car, and admins hear of it. */
  private async pickupPinLocked(booking: IBooking): Promise<void> {
    const ride = await Ride.findById(booking.ride).select('vehicle.plateNumber').lean();
    const plate = ride?.vehicle?.plateNumber ? phrase('pickupPin.onlyPlate', { plate: ride.vehicle.plateNumber }) : '';
    await new NotificationService().sendPushNotification(
      booking.rider.toString(),
      phrase('pickupPin.lockedTitle'),
      phrase('pickupPin.lockedBody', { plate }),
      { type: 'pickup_pin', bookingId: booking._id.toString() },
    ).catch(() => undefined);
    const { pushAdmins } = await import('./SafetyAlerts');
    await pushAdmins('Pickup codes', 'A driver entered five wrong pickup codes for a rider. Check the ride in the admin.', { type: 'pickup_pin', bookingId: booking._id.toString() });
  }

  /** The rider has been dropped (UC-D04 step 12): settles this booking. */
  async markDroppedOff(bookingId: string, driverId: string): Promise<IBooking> {
    const booking = await this.driverBookingOnRideUnderWay(bookingId, driverId);
    if (!booking.actualPickupTime) throw new ConflictError('Mark the rider as picked up first');
    booking.driverConfirmedDropoff = true;
    await booking.save();
    return this.completeBooking(bookingId, driverId);
  }

  /**
   * The rider did not come within the waiting time (UC-D07). The booking is
   * cancelled with no refund; the fare goes to the driver less the platform fee.
   */
  async reportNoShow(bookingId: string, driverId: string): Promise<IBooking> {
    const booking = await this.driverBookingOnRideUnderWay(bookingId, driverId);
    if (booking.actualPickupTime) throw new ConflictError('This rider was picked up');
    if (!booking.driverArrivedAt) throw new ConflictError('Mark that you have arrived first, then wait for the rider');
    const waitedMins = (Date.now() - booking.driverArrivedAt.getTime()) / 60_000;
    if (waitedMins < config.ride.noShowWaitMins) {
      const left = Math.ceil(config.ride.noShowWaitMins - waitedMins);
      throw new AppError(`Wait ${left} more minute${left === 1 ? '' : 's'} before reporting a no-show`, 409, 'WAIT_FOR_RIDER');
    }

    // The rider's own part; the company pays nothing for a trip that did not happen
    const fee = riderPays(booking);
    const platformFee = round2(fee * config.ride.platformFeeRate);
    booking.status = BookingStatus.CANCELLED;
    booking.noShow = true;
    booking.cancelledBy = new Types.ObjectId(driverId);
    booking.cancellationReason = 'The rider did not come to the pickup';
    booking.cancelledAt = new Date();
    booking.refundAmount = 0;
    booking.cancellationFee = fee;
    booking.platformFee = platformFee;
    booking.driverEarnings = round2(fee - platformFee);
    await booking.save();

    await Promise.all([
      Ride.findByIdAndUpdate(booking.ride, { $inc: { availableSeats: booking.seatsBooked } }),
      User.findByIdAndUpdate(driverId, { $inc: { 'stats.totalEarnings': booking.driverEarnings } }),
    ]);

    EventBridge.publish('booking-events', {
      eventType: 'booking.no_show',
      data: { bookingId: booking._id, riderId: booking.rider.toString(), driverId },
    });
    return booking;
  }

  /** A confirmed booking of this driver's, on a ride that has started */
  private async driverBookingOnRideUnderWay(bookingId: string, driverId: string, select?: string): Promise<IBooking> {
    const booking = select ? await Booking.findById(bookingId).select(select) : await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    if (booking.driver.toString() !== driverId) throw new AuthorizationError('Only the ride\'s driver can do this');
    if (booking.status !== BookingStatus.CONFIRMED) throw new ConflictError('This booking is not active');
    const ride = await Ride.findById(booking.ride).select('status');
    if (ride?.status !== RideStatus.IN_PROGRESS) throw new ConflictError('Start the ride first');
    return booking;
  }

  /**
   * What a booking would cost the rider, before they make it: the fare, what
   * their company pays (UC-C01) and the rest, which is theirs to pay.
   */
  async quote(riderId: string, data: { rideId: string; seatsBooked: number; pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number } }) {
    const ride = await Ride.findById(data.rideId).select('pricePerSeat departureTime');
    if (!ride) throw new NotFoundError('Ride');
    const fare = round2(ride.pricePerSeat * data.seatsBooked);
    const company = await companyContribution({ riderId, fare, departure: ride.departureTime, pickup: data.pickup, dropoff: data.dropoff });
    return {
      fare,
      companyShare: company?.share ?? 0,
      youPay: riderPays({ estimatedFare: fare, companyShare: company?.share }),
      ...(company ? { company: company.company, ...(company.limitedBy ? { limitedBy: company.limitedBy } : {}) } : {}),
    };
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
    // The company's part carries its own, lower commission (UC-C01)
    const companyPart = booking.companyShare ?? 0;
    const riderPart = riderPays(booking);
    const platformFee = round2(riderPart * config.ride.platformFeeRate + (companyPart > 0 ? companyPart * config.ride.companyFeeRate : 0));
    const driverEarnings = round2(finalFare - platformFee);

    booking.status = BookingStatus.COMPLETED;
    booking.finalFare = finalFare;
    booking.driverEarnings = driverEarnings;
    booking.platformFee = platformFee;
    booking.actualDropoffTime = new Date();

    // CO₂ saved by this seat (UC-R11). An estimate, so a failure only leaves it unmeasured
    let carbon = { distanceKm: 0, co2SavedKg: 0 };
    try {
      carbon = await carbonService.measureBooking(booking);
      booking.distanceKm = carbon.distanceKm;
      booking.co2SavedKg = carbon.co2SavedKg;
    } catch (error) {
      logger.warn('Could not measure the CO₂ saved', { bookingId, error: (error as Error).message });
    }
    await booking.save();

    // Update driver & rider stats
    const shared = { 'stats.co2SavedKg': carbon.co2SavedKg, 'stats.kmShared': carbon.distanceKm };
    await Promise.all([
      User.findByIdAndUpdate(driverId, {
        $inc: {
          'stats.totalRidesAsDriver': 1,
          'stats.totalEarnings': driverEarnings,
          ...shared,
        },
      }),
      User.findByIdAndUpdate(booking.rider, {
        $inc: {
          'stats.totalRidesAsRider': 1,
          'stats.totalSpent': riderPart,
          ...shared,
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
          riderPart,
        ),
      ]);
    } catch (coinError) {
      logger.error('Coin award failed after booking completion', {
        bookingId,
        error: (coinError as Error).message,
      });
    }

    // Receipt by email when the rider has an address and mail is set up
    import('./ReceiptService')
      .then(({ ReceiptService }) => new ReceiptService().emailOnCompletion(bookingId, booking.rider.toString()))
      .catch((error) => logger.warn('Receipt email failed', { bookingId, error: (error as Error).message }));

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
      // Riders see their own pickup code; drivers never do
      Booking.find(filter)
        .select(role === 'rider' ? '+pickupPin' : '')
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

    // A driver sees "Works at" on riders from their own company, never their work email
    if (role === 'driver') {
      const riderIds = bookings.map((b) => (b.get('rider') as { _id?: Types.ObjectId } | null)?._id).filter((id): id is Types.ObjectId => Boolean(id));
      const colleagues = await colleaguesOf(userId, riderIds);
      if (colleagues.size) {
        const items = bookings.map((b) => {
          const json = b.toJSON() as Record<string, unknown> & { rider?: { _id?: unknown } };
          const at = json.rider?._id ? colleagues.get(String(json.rider._id)) : undefined;
          return at ? { ...json, rider: { ...json.rider, colleagueAt: at } } : json;
        });
        return paginate(items as unknown as typeof bookings, total, page, limit);
      }
    }

    return paginate(bookings, total, page, limit);
  }
}
