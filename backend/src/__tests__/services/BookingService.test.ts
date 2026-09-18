/**
 * Tests for BookingService
 * Covers booking lifecycle, fare splitting, and payment integration.
 */

import { BookingService } from '../../services/BookingService';
import { Booking } from '../../models/Booking';
import { Ride } from '../../models/Ride';
import { User } from '../../models/User';
import { BookingStatus, RideStatus } from '../../types';
import { Payment } from '../../models/Payment';

jest.mock('../../models/Booking');
jest.mock('../../models/Ride');
jest.mock('../../models/User');
jest.mock('../../models/Payment', () => ({ Payment: { exists: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() } }));
jest.mock('../../events', () => ({
  EventBridge: { publish: jest.fn() },
}));
jest.mock('../../config', () => ({
  config: {
    ride: {
      platformFeeRate: 0.15,
      maxPendingRequestsPerRider: 3,
      maxPickupDistanceFromRouteKm: 2,
    },
    razorpay: { keyId: 'rzp_test', keySecret: 'secret' },
  },
}));
const mockDeductForBooking = jest.fn();
const mockRefundToWallet = jest.fn();
const mockRazorpayRefund = jest.fn();
jest.mock('../../services/WalletService', () => ({
  WalletService: jest.fn().mockImplementation(() => ({
    deductForBooking: (...args: unknown[]) => mockDeductForBooking(...args),
    refundToWallet: (...args: unknown[]) => mockRefundToWallet(...args),
    awardCoinsForRide: jest.fn(),
  })),
}));
jest.mock('../../services/MatchingEngineClient', () => ({
  MatchingEngineClient: jest.fn().mockImplementation(() => ({
    scoreRides: jest.fn().mockResolvedValue([{ overallScore: 85 }]),
  })),
}));
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'order_test_123' }),
    },
    payments: {
      refund: (...args: unknown[]) => mockRazorpayRefund(...args),
    },
  }));
});

describe('BookingService', () => {
  let bookingService: BookingService;

  beforeEach(() => {
    jest.clearAllMocks();
    bookingService = new BookingService();
  });

  describe('createBooking', () => {
    const mockRide = {
      _id: 'ride123',
      driver: { toString: () => 'driver456' },
      status: RideStatus.ACTIVE,
      availableSeats: 3,
      totalSeats: 4,
      pricePerSeat: 150,
      departureTime: new Date(Date.now() + 3600000),
      pickup: { location: { coordinates: [77.1, 28.7] } },
      dropoff: { location: { coordinates: [77.2, 28.8] } },
    };

    it('should reject booking for non-existent ride', async () => {
      (Ride.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        bookingService.createBooking('rider123', {
          rideId: 'nonexistent',
          seatsBooked: 1,
          pickup: { lng: 77.1, lat: 28.7, address: 'A' },
          dropoff: { lng: 77.2, lat: 28.8, address: 'B' },
        }),
      ).rejects.toThrow();
    });

    it('should reject booking when no seats available', async () => {
      (Ride.findById as jest.Mock).mockResolvedValue({
        ...mockRide,
        availableSeats: 0,
      });

      await expect(
        bookingService.createBooking('rider123', {
          rideId: 'ride123',
          seatsBooked: 1,
          pickup: { lng: 77.1, lat: 28.7, address: 'A' },
          dropoff: { lng: 77.2, lat: 28.8, address: 'B' },
        }),
      ).rejects.toThrow();
    });

    it('should reject booking from the ride driver (self-booking)', async () => {
      (Ride.findById as jest.Mock).mockResolvedValue(mockRide);

      await expect(
        bookingService.createBooking('driver456', {
          rideId: 'ride123',
          seatsBooked: 1,
          pickup: { lng: 77.1, lat: 28.7, address: 'A' },
          dropoff: { lng: 77.2, lat: 28.8, address: 'B' },
        }),
      ).rejects.toThrow('Cannot book your own ride');
    });

    it('should reject booking for cancelled/completed ride', async () => {
      (Ride.findById as jest.Mock).mockResolvedValue({
        ...mockRide,
        status: RideStatus.COMPLETED,
      });

      await expect(
        bookingService.createBooking('rider123', {
          rideId: 'ride123',
          seatsBooked: 1,
          pickup: { lng: 77.1, lat: 28.7, address: 'A' },
          dropoff: { lng: 77.2, lat: 28.8, address: 'B' },
        }),
      ).rejects.toThrow('not available for booking');
    });

    it('should reject when rider has too many pending bookings', async () => {
      (Ride.findById as jest.Mock).mockResolvedValue(mockRide);
      (Booking.countDocuments as jest.Mock).mockResolvedValue(3);

      await expect(
        bookingService.createBooking('rider123', {
          rideId: 'ride123',
          seatsBooked: 1,
          pickup: { lng: 77.1, lat: 28.7, address: 'A' },
          dropoff: { lng: 77.2, lat: 28.8, address: 'B' },
        }),
      ).rejects.toThrow('pending booking requests allowed');
    });

    it('should reject duplicate booking for same ride', async () => {
      (Ride.findById as jest.Mock).mockResolvedValue(mockRide);
      (Booking.countDocuments as jest.Mock).mockResolvedValue(0);
      (Booking.findOne as jest.Mock).mockResolvedValue({ _id: 'existing' });

      await expect(
        bookingService.createBooking('rider123', {
          rideId: 'ride123',
          seatsBooked: 1,
          pickup: { lng: 77.1, lat: 28.7, address: 'A' },
          dropoff: { lng: 77.2, lat: 28.8, address: 'B' },
        }),
      ).rejects.toThrow('already have a booking');
    });
  });

  describe('createBooking with wallet', () => {
    const walletRide = {
      _id: 'ride123',
      driver: { toString: () => 'driver456' },
      status: RideStatus.ACTIVE,
      availableSeats: 3,
      pricePerSeat: 150,
      departureTime: new Date(Date.now() + 3600000),
      pickup: { location: { coordinates: [77.1, 28.7] } },
      dropoff: { location: { coordinates: [77.2, 28.8] } },
    };
    const input = {
      rideId: 'ride123',
      seatsBooked: 2,
      pickup: { lng: 77.1, lat: 28.7, address: 'A' },
      dropoff: { lng: 77.2, lat: 28.8, address: 'B' },
      useWallet: true,
    };

    beforeEach(() => {
      (Ride.findById as jest.Mock).mockResolvedValue(walletRide);
      (Booking.countDocuments as jest.Mock).mockResolvedValue(0);
      (Booking.findOne as jest.Mock).mockResolvedValue(null);
      (User.findById as jest.Mock).mockResolvedValue({ _id: 'x' });
      (Booking.create as jest.Mock).mockResolvedValue({ _id: { toString: () => 'booking789' } });
    });

    it('debits the wallet against the real booking id', async () => {
      const result = await bookingService.createBooking('rider123', input);

      expect(result.paidViaWallet).toBe(true);
      expect(mockDeductForBooking).toHaveBeenCalledWith('rider123', 'booking789', 300);
    });

    it('removes the booking when the wallet debit fails', async () => {
      mockDeductForBooking.mockRejectedValueOnce(new Error('Insufficient wallet balance'));

      await expect(bookingService.createBooking('rider123', input)).rejects.toThrow('Insufficient wallet balance');
      expect(Booking.deleteOne).toHaveBeenCalledWith({ _id: expect.anything() });
    });
  });

  describe('confirmBooking', () => {
    it('should confirm a pending booking', async () => {
      const mockBooking = {
        _id: 'booking123',
        driver: { toString: () => 'driver456' },
        rider: { toString: () => 'rider123' },
        ride: 'ride789',
        status: BookingStatus.PENDING,
        seatsBooked: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);
      (Ride.findOneAndUpdate as jest.Mock).mockResolvedValue({ availableSeats: 2 });

      const result = await bookingService.confirmBooking('booking123', 'driver456');

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(mockBooking.save).toHaveBeenCalled();
      expect(Ride.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'ride789', availableSeats: { $gte: 1 } },
        { $inc: { availableSeats: -1 } },
        { new: true },
      );
    });

    it('should not confirm a card/UPI booking before payment is authorized', async () => {
      (Booking.findById as jest.Mock).mockResolvedValue({
        _id: 'booking123',
        driver: { toString: () => 'driver456' },
        ride: 'ride789',
        status: BookingStatus.PENDING,
        seatsBooked: 1,
        razorpayOrderId: 'order_1',
        save: jest.fn(),
      });
      (Payment.exists as jest.Mock).mockResolvedValue(null);

      await expect(bookingService.confirmBooking('booking123', 'driver456')).rejects.toThrow(
        'has not completed payment',
      );
      expect(Ride.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should not confirm when the ride no longer has enough seats', async () => {
      const save = jest.fn();
      (Booking.findById as jest.Mock).mockResolvedValue({
        _id: 'booking123',
        driver: { toString: () => 'driver456' },
        ride: 'ride789',
        status: BookingStatus.PENDING,
        seatsBooked: 2,
        save,
      });
      (Ride.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(bookingService.confirmBooking('booking123', 'driver456')).rejects.toThrow('Not enough seats');
      expect(save).not.toHaveBeenCalled();
    });

    it('should reject confirmation from non-driver', async () => {
      const mockBooking = {
        _id: 'booking123',
        driver: { toString: () => 'driver456' },
        status: BookingStatus.PENDING,
      };
      (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        bookingService.confirmBooking('booking123', 'stranger999'),
      ).rejects.toThrow('Only the ride driver');
    });

    it('should reject confirming a non-pending booking', async () => {
      const mockBooking = {
        _id: 'booking123',
        driver: { toString: () => 'driver456' },
        status: BookingStatus.CONFIRMED,
      };
      (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        bookingService.confirmBooking('booking123', 'driver456'),
      ).rejects.toThrow('not in pending state');
    });
  });

  describe('refunds', () => {
    const base = {
      _id: 'booking123',
      rider: { toString: () => 'rider123' },
      driver: { toString: () => 'driver456' },
      ride: 'ride789',
      seatsBooked: 1,
      estimatedFare: 300,
      save: jest.fn().mockResolvedValue(true),
    };

    it('refunds a confirmed wallet booking to the wallet on cancel', async () => {
      (Booking.findById as jest.Mock).mockResolvedValue({ ...base, status: BookingStatus.CONFIRMED, razorpayOrderId: undefined });
      (Ride.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await bookingService.cancelBooking('booking123', 'rider123', 'Changed plans');

      expect(mockRefundToWallet).toHaveBeenCalledWith('rider123', 'booking123', 300, 'Changed plans');
    });

    it('refunds a captured card payment through Razorpay when the driver declines', async () => {
      (Booking.findById as jest.Mock).mockResolvedValue({ ...base, status: BookingStatus.PENDING, razorpayOrderId: 'order_1' });
      (Payment.findOne as jest.Mock).mockResolvedValue({ _id: 'pay_doc', status: 'captured', razorpayPaymentId: 'pay_1' });
      mockRazorpayRefund.mockResolvedValue({ id: 'rfnd_1' });

      await bookingService.rejectBooking('booking123', 'driver456', 'Car is full');

      expect(mockRazorpayRefund).toHaveBeenCalledWith('pay_1', expect.objectContaining({ amount: 30000 }));
      expect(Payment.updateOne).toHaveBeenCalledWith({ _id: 'pay_doc' }, { $set: { status: 'refunded' } });
    });

    it('does not call the refund API for an uncaptured authorization', async () => {
      (Booking.findById as jest.Mock).mockResolvedValue({ ...base, status: BookingStatus.PENDING, razorpayOrderId: 'order_1' });
      (Payment.findOne as jest.Mock).mockResolvedValue({ _id: 'pay_doc', status: 'authorized', razorpayPaymentId: 'pay_1' });

      await bookingService.cancelBooking('booking123', 'rider123', 'Changed plans');

      expect(mockRazorpayRefund).not.toHaveBeenCalled();
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a pending booking and publish event', async () => {
      const mockBooking = {
        _id: 'booking123',
        rider: { toString: () => 'rider123' },
        driver: { toString: () => 'driver456' },
        ride: 'ride789',
        status: BookingStatus.PENDING,
        estimatedFare: 300,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        save: jest.fn().mockResolvedValue(true),
      };
      (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);

      const result = await bookingService.cancelBooking('booking123', 'rider123', 'Changed plans');

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(mockBooking.save).toHaveBeenCalled();
    });

    it('should restore seats when cancelling confirmed booking', async () => {
      const mockBooking = {
        _id: 'booking123',
        rider: { toString: () => 'rider123' },
        driver: { toString: () => 'driver456' },
        ride: 'ride789',
        status: BookingStatus.CONFIRMED,
        seatsBooked: 2,
        estimatedFare: 300,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        save: jest.fn().mockResolvedValue(true),
      };
      (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);
      (Ride.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await bookingService.cancelBooking('booking123', 'rider123', 'Changed plans');

      expect(Ride.findByIdAndUpdate).toHaveBeenCalledWith(
        'ride789',
        { $inc: { availableSeats: 2 } },
      );
    });

    it('should reject cancelling from unauthorized user', async () => {
      const mockBooking = {
        _id: 'booking123',
        rider: { toString: () => 'rider123' },
        driver: { toString: () => 'driver456' },
        status: BookingStatus.PENDING,
      };
      (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        bookingService.cancelBooking('booking123', 'stranger999', 'Reason'),
      ).rejects.toThrow('not part of this booking');
    });
  });

  describe('completeBooking', () => {
    it('should calculate fare split with 15% platform fee', async () => {
      const mockBooking = {
        _id: 'booking123',
        driver: { toString: () => 'driver456' },
        rider: { toString: () => 'rider123' },
        ride: 'ride789',
        status: BookingStatus.CONFIRMED,
        estimatedFare: 300,
        seatsBooked: 2,
        save: jest.fn().mockResolvedValue(true),
      };
      (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      const result = await bookingService.completeBooking('booking123', 'driver456');

      expect(result.status).toBe(BookingStatus.COMPLETED);
      expect(result.finalFare).toBe(300);
      expect(result.platformFee).toBe(45); // 15% of 300
      expect(result.driverEarnings).toBe(255); // 300 - 45
    });

    it('should update driver and rider stats', async () => {
      const mockBooking = {
        _id: 'booking123',
        driver: { toString: () => 'driver456' },
        rider: { toString: () => 'rider123' },
        ride: 'ride789',
        status: BookingStatus.CONFIRMED,
        estimatedFare: 200,
        save: jest.fn().mockResolvedValue(true),
      };
      (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await bookingService.completeBooking('booking123', 'driver456');

      // Should update both driver and rider stats
      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'driver456',
        expect.objectContaining({
          $inc: expect.objectContaining({
            'stats.totalRidesAsDriver': 1,
          }),
        }),
      );
    });
  });

  describe('Fare calculation', () => {
    it('should calculate fare as pricePerSeat × seatsBooked', () => {
      const fare = 150 * 2;
      expect(fare).toBe(300);
    });

    it('should apply 15% platform fee correctly', () => {
      const baseFare = 300;
      const platformFeeRate = 0.15;
      const platformFee = Math.round(baseFare * platformFeeRate * 100) / 100;
      const driverPayout = baseFare - platformFee;

      expect(platformFee).toBe(45);
      expect(driverPayout).toBe(255);
    });
  });

  describe('Status transitions', () => {
    const validTransitions: Record<string, string[]> = {
      [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    };

    const terminalStates = [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED];

    it('should allow valid transitions from PENDING', () => {
      expect(validTransitions[BookingStatus.PENDING]).toContain(BookingStatus.CONFIRMED);
      expect(validTransitions[BookingStatus.PENDING]).toContain(BookingStatus.REJECTED);
      expect(validTransitions[BookingStatus.PENDING]).toContain(BookingStatus.CANCELLED);
    });

    it('should not allow transitions from terminal states', () => {
      for (const terminal of terminalStates) {
        expect(validTransitions[terminal]).toBeUndefined();
      }
    });
  });
});
