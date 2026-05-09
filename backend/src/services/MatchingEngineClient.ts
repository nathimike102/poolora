import { IRide } from '../models/Ride';
import { IUser } from '../models/User';
import { MatchScore, RideSearchParams } from '../types';
import { haversineDistanceKm, minutesBetween } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * Matching Engine — applies the 5-Factor Weighted Score:
 *   Proximity 40%, Time 30%, Rating 15%, Acceptance 10%, Safety 5%
 *
 * In production, this would call out to a Python/FastAPI ML service.
 * This implementation provides the deterministic scoring locally.
 */
export class MatchingEngineClient {
  private static readonly WEIGHTS = {
    proximity: 0.4,
    time: 0.3,
    rating: 0.15,
    acceptance: 0.1,
    safety: 0.05,
  };

  /**
   * Score a list of candidate rides against a rider's search parameters.
   */
  async scoreRides(
    candidates: Array<{ ride: IRide; driver: IUser }>,
    params: RideSearchParams,
  ): Promise<MatchScore[]> {
    const scores: MatchScore[] = [];

    for (const { ride, driver } of candidates) {
      try {
        const score = this.computeScore(ride, driver, params);
        scores.push(score);
      } catch (err) {
        logger.warn('Failed to score ride', {
          rideId: ride._id,
          error: (err as Error).message,
        });
      }
    }

    // Sort by overall score descending
    scores.sort((a, b) => b.overallScore - a.overallScore);

    return scores;
  }

  private computeScore(
    ride: IRide,
    driver: IUser,
    params: RideSearchParams,
  ): MatchScore {
    // ── Proximity Score (40%) ──
    const pickupDistKm = haversineDistanceKm(
      params.pickupLat,
      params.pickupLng,
      ride.pickup.location.coordinates[1],
      ride.pickup.location.coordinates[0],
    );
    const maxRadius = params.radiusKm || 5;
    const proximityScore = Math.max(0, 1 - pickupDistKm / maxRadius) * 100;

    // ── Time Score (30%) ──
    const timeDiffMins = minutesBetween(
      new Date(params.departureTime),
      new Date(ride.departureTime),
    );
    const maxTimeDev = params.timeDeviationMins || 120;
    const timeScore = Math.max(0, 1 - timeDiffMins / maxTimeDev) * 100;

    // ── Rating Score (15%) ──
    const driverRating = driver.stats.avgRatingAsDriver || 3;
    const ratingScore = (driverRating / 5) * 100;

    // ── Acceptance Score (10%) ──
    const acceptanceRate = driver.stats.acceptanceRate || 0.5;
    const acceptanceScore = acceptanceRate * 100;

    // ── Safety Score (5%) ──
    const cancellationRate = driver.stats.cancellationRate || 0;
    const safetyScore = (1 - cancellationRate) * 100;

    // ── Weighted Overall ──
    const overallScore =
      MatchingEngineClient.WEIGHTS.proximity * proximityScore +
      MatchingEngineClient.WEIGHTS.time * timeScore +
      MatchingEngineClient.WEIGHTS.rating * ratingScore +
      MatchingEngineClient.WEIGHTS.acceptance * acceptanceScore +
      MatchingEngineClient.WEIGHTS.safety * safetyScore;

    // ── Fare estimate ──
    const estimatedFare = ride.pricePerSeat;

    // ── ETA estimate (rough: 40 km/h average in city) ──
    const estimatedETA = Math.round((pickupDistKm / 40) * 60);

    return {
      rideId: ride._id.toString(),
      overallScore: Math.round(overallScore * 100) / 100,
      proximityScore: Math.round(proximityScore * 100) / 100,
      timeScore: Math.round(timeScore * 100) / 100,
      ratingScore: Math.round(ratingScore * 100) / 100,
      acceptanceScore: Math.round(acceptanceScore * 100) / 100,
      safetyScore: Math.round(safetyScore * 100) / 100,
      estimatedFare,
      estimatedETA,
      distanceKm: Math.round(pickupDistKm * 100) / 100,
    };
  }
}
