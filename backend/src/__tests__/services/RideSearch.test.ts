/**
 * Ride search must only return rides whose route passes near the rider AND
 * near where they are going. RideSearch.route.test.ts runs the real query.
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
  it('searches by distance to the route near the pickup and requires the route to reach the destination', async () => {
    (User.findById as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId(), gender: 'female' });
    (User.find as jest.Mock).mockResolvedValue([]);
    (Ride.aggregate as jest.Mock).mockResolvedValue([]);

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
    expect(geoNear.key).toBe('routeLine');
    // A 5 km circle around the destination that the route must cross
    const ring: [number, number][] = geoNear.query.routeLine.$geoIntersects.$geometry.coordinates[0];
    const toRad = (d: number) => (d * Math.PI) / 180;
    for (const [lng, lat] of ring) {
      const dLat = toRad(lat - 17.0012);
      const dLng = toRad(lng - 82.2811) * Math.cos(toRad(17.0012));
      expect(Math.hypot(dLat, dLng) * 6_378_100).toBeCloseTo(5000, -2);
    }
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
