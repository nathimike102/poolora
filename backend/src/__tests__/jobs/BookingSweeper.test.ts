/**
 * Time-based booking rules: unpaid requests are cancelled after 15 minutes,
 * unanswered ones expire after 6 hours or once the ride has left, and rides
 * nobody booked are cancelled an hour before departure.
 */
const mockExpireBooking = jest.fn();
jest.mock('../../services/BookingService', () => ({
  BookingService: jest.fn().mockImplementation(() => ({ expireBooking: mockExpireBooking })),
}));
jest.mock('../../models/Booking', () => ({ Booking: { find: jest.fn(), exists: jest.fn() } }));
jest.mock('../../models/Ride', () => ({ Ride: { find: jest.fn(), findOneAndUpdate: jest.fn() } }));
jest.mock('../../models/Payment', () => ({ Payment: { exists: jest.fn() } }));
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../config/redis', () => ({ getRedisClient: () => null }));

import { BookingSweeper } from '../../jobs/BookingSweeper';
import { Booking } from '../../models/Booking';
import { Ride } from '../../models/Ride';
import { Payment } from '../../models/Payment';
import { EventBridge } from '../../events';
import { BookingStatus, RideStatus } from '../../types';

const now = new Date('2026-09-23T10:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const minutesAhead = (m: number) => new Date(now.getTime() + m * 60_000);

/** Booking.find is called for unpaid requests first, then for all pending ones. */
function pendingBookings(unpaid: unknown[], pending: unknown[]) {
  (Booking.find as jest.Mock)
    .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(unpaid) })
    .mockReturnValueOnce({
      select: () => ({ populate: () => ({ lean: jest.fn().mockResolvedValue(pending) }) }),
    });
}

function ridesDueSoon(rides: unknown[]) {
  (Ride.find as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(rides) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExpireBooking.mockResolvedValue(true);
});

describe('BookingSweeper', () => {
  it('cancels a card request that is still unpaid after 15 minutes', async () => {
    pendingBookings([{ _id: 'b1', razorpayOrderId: 'order_1' }], []);
    ridesDueSoon([]);
    (Payment.exists as jest.Mock).mockResolvedValue(null);

    const result = await BookingSweeper.runOnce(now);

    expect(Booking.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingStatus.PENDING, createdAt: { $lt: minutesAgo(15) } }),
    );
    expect(mockExpireBooking).toHaveBeenCalledWith('b1', BookingStatus.CANCELLED, expect.stringContaining('15 minutes'));
    expect(result.unpaidCancelled).toBe(1);
  });

  it('keeps a request that was paid, waiting for the driver', async () => {
    pendingBookings([{ _id: 'b1', razorpayOrderId: 'order_1' }], []);
    ridesDueSoon([]);
    (Payment.exists as jest.Mock).mockResolvedValue({ _id: 'p1' });

    const result = await BookingSweeper.runOnce(now);

    expect(mockExpireBooking).not.toHaveBeenCalled();
    expect(result.unpaidCancelled).toBe(0);
  });

  it('expires requests older than 6 hours and requests whose ride has left', async () => {
    pendingBookings([], [
      { _id: 'old', createdAt: minutesAgo(7 * 60), ride: { departureTime: minutesAhead(600) } },
      { _id: 'departed', createdAt: minutesAgo(30), ride: { departureTime: minutesAgo(5) } },
      { _id: 'fresh', createdAt: minutesAgo(30), ride: { departureTime: minutesAhead(120) } },
    ]);
    ridesDueSoon([]);

    const result = await BookingSweeper.runOnce(now);

    const expired = mockExpireBooking.mock.calls.map(([id]) => id);
    expect(expired).toEqual(['old', 'departed']);
    expect(mockExpireBooking).toHaveBeenCalledWith('old', BookingStatus.REJECTED, 'The driver did not respond in time');
    expect(result.requestsExpired).toBe(2);
  });

  it('cancels a ride nobody booked an hour before departure and tells the driver', async () => {
    pendingBookings([], []);
    ridesDueSoon([{ _id: 'r1', driver: 'd1' }, { _id: 'r2', driver: 'd2' }]);
    (Booking.exists as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'b9' });
    (Ride.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'r1' });

    const result = await BookingSweeper.runOnce(now);

    expect(Ride.find).toHaveBeenCalledWith({
      status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE] },
      departureTime: { $lte: minutesAhead(60) },
      createdAt: { $lt: minutesAgo(60) },
    });
    expect(Ride.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(EventBridge.publish).toHaveBeenCalledWith('ride-events', {
      eventType: 'ride.cancelled',
      data: expect.objectContaining({ rideId: 'r1', driverId: 'd1', automatic: true }),
    });
    expect(result.emptyRidesCancelled).toBe(1);
  });
});
