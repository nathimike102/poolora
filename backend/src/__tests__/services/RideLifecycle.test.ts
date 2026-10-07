/**
 * A ride is started by its driver once someone is confirmed, and completing
 * it settles every confirmed booking so riders can rate and drivers get paid.
 */
const mockCompleteBooking = jest.fn();
const mockCancelBooking = jest.fn();
jest.mock('../../models/Ride', () => ({ Ride: { findById: jest.fn() } }));
jest.mock('../../models/User', () => ({ User: {} }));
jest.mock('../../models/Booking', () => ({ Booking: { find: jest.fn() } }));
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn() }));
jest.mock('../../services/MatchingEngineClient', () => ({ MatchingEngineClient: jest.fn() }));
jest.mock('../../services/BookingService', () => ({
  BookingService: jest.fn().mockImplementation(() => ({ completeBooking: mockCompleteBooking, cancelBooking: mockCancelBooking })),
}));

import { Types } from 'mongoose';
import { Ride } from '../../models/Ride';
import { Booking } from '../../models/Booking';
import { EventBridge } from '../../events';
import { RideService } from '../../services/RideService';
import { RideStatus } from '../../types';

const driverId = new Types.ObjectId().toString();

function rideWith(status: RideStatus) {
  return { _id: 'ride1', driver: { toString: () => driverId }, status, save: jest.fn() } as Record<string, unknown>;
}

function bookingsFound(list: unknown[]) {
  (Booking.find as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(list) });
}

describe('RideService ride lifecycle', () => {
  it('starts a scheduled ride with a confirmed rider and tells the riders', async () => {
    const ride = rideWith(RideStatus.SCHEDULED);
    (Ride.findById as jest.Mock).mockResolvedValue(ride);
    bookingsFound([{ rider: { toString: () => 'rider1' } }]);

    await new RideService().startRide('ride1', driverId);

    expect(ride.status).toBe(RideStatus.IN_PROGRESS);
    expect(ride.startedAt).toBeInstanceOf(Date);
    expect(EventBridge.publish).toHaveBeenCalledWith('ride-events', {
      eventType: 'ride.started',
      data: { rideId: 'ride1', driverId, riderIds: ['rider1'] },
    });
  });

  it('will not start a ride nobody is confirmed on', async () => {
    (Ride.findById as jest.Mock).mockResolvedValue(rideWith(RideStatus.SCHEDULED));
    bookingsFound([]);

    await expect(new RideService().startRide('ride1', driverId)).rejects.toThrow(
      'Accept at least one rider before starting the ride',
    );
  });

  it('only lets the driver start their own ride', async () => {
    (Ride.findById as jest.Mock).mockResolvedValue(rideWith(RideStatus.SCHEDULED));

    await expect(new RideService().startRide('ride1', new Types.ObjectId().toString())).rejects.toThrow(
      'Only the driver can start the ride',
    );
  });

  it('settles each confirmed booking when the ride is completed', async () => {
    const ride = rideWith(RideStatus.IN_PROGRESS);
    (Ride.findById as jest.Mock).mockResolvedValue(ride);
    const pickedUp = new Date();
    bookingsFound([{ _id: 'b1', actualPickupTime: pickedUp }, { _id: 'b2', actualPickupTime: pickedUp }]);
    mockCompleteBooking.mockRejectedValueOnce(new Error('already settled')).mockResolvedValueOnce({});

    await new RideService().completeRide('ride1', driverId);

    expect(ride.status).toBe(RideStatus.COMPLETED);
    expect(mockCompleteBooking).toHaveBeenCalledWith('b1', driverId);
    expect(mockCompleteBooking).toHaveBeenCalledWith('b2', driverId);
  });

  it('refunds in full a rider the driver never picked up, instead of charging them', async () => {
    (Ride.findById as jest.Mock).mockResolvedValue(rideWith(RideStatus.IN_PROGRESS));
    bookingsFound([{ _id: 'b1', actualPickupTime: new Date() }, { _id: 'b2' }]);
    mockCompleteBooking.mockReset().mockResolvedValue({});
    mockCancelBooking.mockResolvedValue({});

    await new RideService().completeRide('ride1', driverId);

    expect(mockCompleteBooking).toHaveBeenCalledTimes(1);
    expect(mockCompleteBooking).toHaveBeenCalledWith('b1', driverId);
    expect(mockCancelBooking).toHaveBeenCalledWith('b2', driverId, 'The driver ended the trip without picking you up');
  });
});
