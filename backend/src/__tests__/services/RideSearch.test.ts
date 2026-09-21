/**
 * Ride search must only return rides that start near the rider AND end near
 * where they are going.
 */
jest.mock('../../models/Ride', () => ({ Ride: { aggregate: jest.fn() } }));
jest.mock('../../models/User', () => ({ User: { findById: jest.fn(), find: jest.fn() } }));
jest.mock('../../models/Booking', () => ({ Booking: {} }));
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn() }));
jest.mock('../../services/MatchingEngineClient', () => ({
  MatchingEngineClient: jest.fn().mockImplementation(() => ({ scoreRides: jest.fn().mockResolvedValue([]) })),
}));

import { Types } from 'mongoose';
import { Ride } from '../../models/Ride';
import { User } from '../../models/User';
import { RideService } from '../../services/RideService';

describe('RideService.searchRides', () => {
  it('limits results to rides whose drop-off is within the search radius of the destination', async () => {
    (User.findById as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId(), gender: 'female' });
    (User.find as jest.Mock).mockResolvedValue([]);
    (Ride.aggregate as jest.Mock).mockResolvedValue([{ metadata: [], rides: [] }]);

    await new RideService().searchRides(
      new Types.ObjectId().toString(),
      {
        pickupLat: 16.9702,
        pickupLng: 82.2433,
        dropoffLat: 17.0012,
        dropoffLng: 82.2811,
        departureTime: new Date('2026-09-21T18:00:00Z'),
        radiusKm: 5,
      },
      1,
      20,
    );

    const geoNear = (Ride.aggregate as jest.Mock).mock.calls[0][0][0].$geoNear;
    expect(geoNear.near.coordinates).toEqual([82.2433, 16.9702]);
    expect(geoNear.maxDistance).toBe(5000);
    const [[lng, lat], radians] = geoNear.query['dropoff.location'].$geoWithin.$centerSphere;
    expect([lng, lat]).toEqual([82.2811, 17.0012]);
    expect(radians * 6_378_100).toBeCloseTo(5000);
  });
});
