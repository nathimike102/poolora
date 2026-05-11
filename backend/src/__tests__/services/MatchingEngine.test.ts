/**
 * Tests for MatchingEngineClient
 * Validates the 5-factor weighted scoring algorithm:
 *   Proximity 40%, Time 30%, Rating 15%, Acceptance 10%, Safety 5%
 */

import { MatchingEngineClient } from '../../services/MatchingEngineClient';
import { IRide } from '../../models/Ride';
import { IUser } from '../../models/User';
import { RideSearchParams } from '../../types';

const engine = new MatchingEngineClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockCandidate(overrides: {
  pickupLng?: number;
  pickupLat?: number;
  dropoffLng?: number;
  dropoffLat?: number;
  departureTime?: Date;
  pricePerSeat?: number;
  rating?: number;
  acceptanceRate?: number;
  cancellationRate?: number;
  rideId?: string;
} = {}): { ride: IRide; driver: IUser } {
  return {
    ride: {
      _id: overrides.rideId || 'ride001',
      pickup: {
        location: { coordinates: [overrides.pickupLng ?? 77.1, overrides.pickupLat ?? 28.7] },
      },
      dropoff: {
        location: { coordinates: [overrides.dropoffLng ?? 77.2, overrides.dropoffLat ?? 28.8] },
      },
      departureTime: overrides.departureTime || new Date('2026-05-12T08:00:00Z'),
      pricePerSeat: overrides.pricePerSeat ?? 150,
      totalSeats: 4,
      availableSeats: 3,
    } as unknown as IRide,
    driver: {
      _id: overrides.rideId || 'driver001',
      stats: {
        avgRatingAsDriver: overrides.rating ?? 4.5,
        acceptanceRate: overrides.acceptanceRate ?? 0.9,
        cancellationRate: overrides.cancellationRate ?? 0.05,
      },
    } as unknown as IUser,
  };
}

const baseParams: RideSearchParams = {
  pickupLng: 77.1,
  pickupLat: 28.7,
  dropoffLng: 77.2,
  dropoffLat: 28.8,
  departureTime: new Date('2026-05-12T08:00:00Z'),
  radiusKm: 5,
  timeDeviationMins: 120,
};

describe('MatchingEngineClient', () => {
  describe('scoreRides', () => {
    it('should return scores sorted by overallScore descending', async () => {
      const candidates = [
        mockCandidate({ rideId: 'ride-far', pickupLng: 77.5, pickupLat: 29.0, rating: 3.0 }),
        mockCandidate({ rideId: 'ride-near', pickupLng: 77.1, pickupLat: 28.7, rating: 4.8 }),
        mockCandidate({ rideId: 'ride-mid', pickupLng: 77.15, pickupLat: 28.72, rating: 4.0 }),
      ];

      const scores = await engine.scoreRides(candidates, baseParams);

      expect(scores).toHaveLength(3);
      expect(scores[0].rideId).toBe('ride-near');
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i].overallScore).toBeLessThanOrEqual(scores[i - 1].overallScore);
      }
    });

    it('should compute all required score factors', async () => {
      const scores = await engine.scoreRides([mockCandidate()], baseParams);
      const s = scores[0];

      expect(s).toHaveProperty('overallScore');
      expect(s).toHaveProperty('proximityScore');
      expect(s).toHaveProperty('timeScore');
      expect(s).toHaveProperty('ratingScore');
      expect(s).toHaveProperty('acceptanceScore');
      expect(s).toHaveProperty('safetyScore');
      expect(s).toHaveProperty('estimatedFare');
      expect(s).toHaveProperty('estimatedETA');
      expect(s).toHaveProperty('distanceKm');
    });

    it('should give perfect proximity score for exact location match', async () => {
      const scores = await engine.scoreRides(
        [mockCandidate({ pickupLng: 77.1, pickupLat: 28.7 })],
        baseParams,
      );
      expect(scores[0].proximityScore).toBe(100);
    });

    it('should give 0 proximity score for ride beyond search radius', async () => {
      const scores = await engine.scoreRides(
        [mockCandidate({ pickupLng: 78.0, pickupLat: 29.5 })],
        { ...baseParams, radiusKm: 2 },
      );
      expect(scores[0].proximityScore).toBe(0);
    });

    it('should give perfect time score for matching departure times', async () => {
      const scores = await engine.scoreRides(
        [mockCandidate({ departureTime: new Date('2026-05-12T08:00:00Z') })],
        baseParams,
      );
      expect(scores[0].timeScore).toBe(100);
    });

    it('should give maximum overall score for perfect match', async () => {
      const perfectCandidate = mockCandidate({
        pickupLng: 77.1,
        pickupLat: 28.7,
        departureTime: new Date('2026-05-12T08:00:00Z'),
        rating: 5.0,
        acceptanceRate: 1.0,
        cancellationRate: 0.0,
      });

      const scores = await engine.scoreRides([perfectCandidate], baseParams);
      expect(scores[0].overallScore).toBe(100);
    });

    it('should handle candidates with zero/default driver stats', async () => {
      const scores = await engine.scoreRides(
        [mockCandidate({ rating: 0, acceptanceRate: 0, cancellationRate: 0 })],
        baseParams,
      );
      expect(scores).toHaveLength(1);
      expect(scores[0].overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array for empty candidate list', async () => {
      const scores = await engine.scoreRides([], baseParams);
      expect(scores).toHaveLength(0);
    });

    it('should include estimated fare from ride pricePerSeat', async () => {
      const scores = await engine.scoreRides(
        [mockCandidate({ pricePerSeat: 250 })],
        baseParams,
      );
      expect(scores[0].estimatedFare).toBe(250);
    });

    it('should calculate distanceKm as a non-negative number', async () => {
      const scores = await engine.scoreRides([mockCandidate()], baseParams);
      expect(scores[0].distanceKm).toBeGreaterThanOrEqual(0);
      expect(typeof scores[0].distanceKm).toBe('number');
    });

    it('should lower rating score for poorly-rated drivers', async () => {
      const goodDriver = mockCandidate({ rideId: 'good', rating: 5.0 });
      const badDriver = mockCandidate({ rideId: 'bad', rating: 1.0 });

      const [goodScores, badScores] = await Promise.all([
        engine.scoreRides([goodDriver], baseParams),
        engine.scoreRides([badDriver], baseParams),
      ]);

      expect(goodScores[0].ratingScore).toBeGreaterThan(badScores[0].ratingScore);
    });

    it('should lower safety score for drivers with high cancellation rates', async () => {
      const reliable = mockCandidate({ rideId: 'reliable', cancellationRate: 0.0 });
      const flaky = mockCandidate({ rideId: 'flaky', cancellationRate: 0.5 });

      const [reliableScores, flakyScores] = await Promise.all([
        engine.scoreRides([reliable], baseParams),
        engine.scoreRides([flaky], baseParams),
      ]);

      expect(reliableScores[0].safetyScore).toBeGreaterThan(flakyScores[0].safetyScore);
    });
  });
});
