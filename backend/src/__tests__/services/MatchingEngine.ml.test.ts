/**
 * ML matching (UC-AI01): search results come from the ML service's
 * /api/match when it is switched on, and from local scoring when it is off,
 * slow or down, with a pause before the service is tried again.
 */
const post = jest.fn();
jest.mock('../../utils/mlClient', () => ({ mlClient: { post: (...a: unknown[]) => post(...a) } }));

import { MatchingEngineClient } from '../../services/MatchingEngineClient';
import { config } from '../../config';
import { IRide } from '../../models/Ride';
import { IUser } from '../../models/User';
import { RideSearchParams } from '../../types';

const matching = config.matching as unknown as { useMlService: boolean };
const services = config.services as unknown as { mlServiceApiKey: string };

const candidate = {
  ride: {
    _id: 'ride1',
    pickup: { location: { coordinates: [77.1, 28.7] } },
    dropoff: { location: { coordinates: [77.2, 28.8] } },
    departureTime: new Date('2026-05-12T08:00:00Z'),
    pricePerSeat: 150,
    availableSeats: 3,
  } as unknown as IRide,
  driver: { _id: 'd1', kyc: { status: 'approved' }, stats: { avgRatingAsDriver: 4.8, acceptanceRate: 0.9, cancellationRate: 0, totalRidesAsDriver: 40 } } as unknown as IUser,
  pickupDistanceKm: 0.4,
};
const params = { pickupLng: 77.1, pickupLat: 28.7, dropoffLng: 77.2, dropoffLat: 28.8, departureTime: new Date('2026-05-12T08:00:00Z') } as RideSearchParams;

beforeEach(() => {
  post.mockReset();
  matching.useMlService = true;
  services.mlServiceApiKey = 'k';
  (MatchingEngineClient as unknown as { mlDownUntil: number }).mlDownUntil = 0;
});

afterAll(() => {
  matching.useMlService = false;
});

it('uses the ML scores, sending the admin weights and the distance to the route', async () => {
  post.mockResolvedValue({ data: [{ ride_id: 'ride1', overall_score: 91, proximity_score: 92, time_score: 100, rating_score: 96, acceptance_score: 90, safety_score: 100, estimated_fare: 150, estimated_eta: 1, distance_km: 0.4 }] });
  const [score] = await new MatchingEngineClient().scoreRides([candidate], params);
  expect(score).toMatchObject({ rideId: 'ride1', overallScore: 91, safetyScore: 100 });
  const body = post.mock.calls[0][1];
  expect(body.weights).toEqual(config.matching.weights);
  expect(body.candidates[0]).toMatchObject({ route_distance_km: 0.4, is_verified: true, total_rides: 40 });
});

it('scores locally when the service fails, and waits a minute before trying it again', async () => {
  post.mockRejectedValue(new Error('timeout of 1500ms exceeded'));
  const engine = new MatchingEngineClient();
  const [first] = await engine.scoreRides([candidate], params);
  expect(first.rideId).toBe('ride1');
  expect(first.overallScore).toBeGreaterThan(0);
  await engine.scoreRides([candidate], params);
  expect(post).toHaveBeenCalledTimes(1);
});

it('does not call the service when it is switched off', async () => {
  matching.useMlService = false;
  await new MatchingEngineClient().scoreRides([candidate], params);
  expect(post).not.toHaveBeenCalled();
});
