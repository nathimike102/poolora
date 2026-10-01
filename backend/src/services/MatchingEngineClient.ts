import { IRide } from '../models/Ride';
import { IUser } from '../models/User';
import { MatchScore, RideSearchParams } from '../types';
import { haversineDistanceKm, minutesBetween } from '../utils/helpers';
import { logger } from '../utils/logger';
import { config } from '../config';

type Candidate = { ride: IRide; driver: IUser; pickupDistanceKm?: number };

/** After the ML service fails, search scores locally for this long before trying it again */
const ML_RETRY_AFTER_MS = 60_000;

/**
 * Matching Engine (UC-AI01): the 5-factor weighted score
 *   Proximity 40%, Time 30%, Rating 15%, Acceptance 10%, Safety 5%
 * (weights are admin-editable).
 *
 * With ML_MATCHING=true and ML_SERVICE_API_KEY set, candidates are scored by
 * the ML service's /api/match, which also credits verified and experienced
 * drivers in the safety factor. If the service is slow or down, the same
 * score is computed here, so search never waits on it or fails because of it.
 */
export class MatchingEngineClient {
  private static mlDownUntil = 0;

  /** Admin-editable (UC-A07), so read on every score */
  private static get WEIGHTS() {
    return config.matching.weights;
  }

  /**
   * Score a list of candidate rides against a rider's search parameters.
   */
  async scoreRides(candidates: Candidate[], params: RideSearchParams): Promise<MatchScore[]> {
    if (candidates.length && config.matching.useMlService && config.services.mlServiceApiKey && Date.now() >= MatchingEngineClient.mlDownUntil) {
      const scored = await this.scoreWithMl(candidates, params);
      if (scored) return scored;
    }
    return this.scoreLocally(candidates, params);
  }

  /** Scores from the ML service, or null when it is unavailable */
  private async scoreWithMl(candidates: Candidate[], params: RideSearchParams): Promise<MatchScore[] | null> {
    try {
      const { mlClient } = await import('../utils/mlClient');
      const { data } = await mlClient.post<Array<Record<string, number | string>>>(
        '/api/match',
        {
          weights: MatchingEngineClient.WEIGHTS,
          search_params: {
            pickup_lat: params.pickupLat,
            pickup_lng: params.pickupLng,
            drop_lat: params.dropoffLat,
            drop_lng: params.dropoffLng,
            departure_time: new Date(params.departureTime).toISOString(),
            radius_km: Math.min(50, Math.max(0.5, params.radiusKm || 5)),
            time_deviation_mins: Math.min(480, Math.max(15, params.timeDeviationMins || 120)),
          },
          candidates: candidates.map(({ ride, driver, pickupDistanceKm }) => ({
            ride_id: ride._id.toString(),
            driver_id: driver._id.toString(),
            pickup_location: { lat: ride.pickup.location.coordinates[1], lng: ride.pickup.location.coordinates[0] },
            drop_location: { lat: ride.dropoff.location.coordinates[1], lng: ride.dropoff.location.coordinates[0] },
            departure_time: new Date(ride.departureTime).toISOString(),
            price_per_seat: ride.pricePerSeat,
            available_seats: ride.availableSeats,
            driver_rating: Math.min(5, Math.max(0, driver.stats?.avgRatingAsDriver || 3)),
            acceptance_rate: Math.min(1, Math.max(0, driver.stats?.acceptanceRate ?? 0.5)),
            cancellation_rate: Math.min(1, Math.max(0, driver.stats?.cancellationRate ?? 0)),
            total_rides: Math.max(0, driver.stats?.totalRidesAsDriver ?? 0),
            is_verified: driver.kyc?.status === 'approved',
            route_distance_km: pickupDistanceKm,
          })),
        },
        { timeout: 1500 },
      );
      if (!Array.isArray(data)) throw new Error('Unexpected response');
      const known = new Set(candidates.map((c) => c.ride._id.toString()));
      return data
        .filter((d) => known.has(String(d.ride_id)))
        .map((d) => ({
          rideId: String(d.ride_id),
          overallScore: Number(d.overall_score),
          proximityScore: Number(d.proximity_score),
          timeScore: Number(d.time_score),
          ratingScore: Number(d.rating_score),
          acceptanceScore: Number(d.acceptance_score),
          safetyScore: Number(d.safety_score),
          estimatedFare: Number(d.estimated_fare),
          estimatedETA: Number(d.estimated_eta),
          distanceKm: Number(d.distance_km),
        }));
    } catch (error) {
      MatchingEngineClient.mlDownUntil = Date.now() + ML_RETRY_AFTER_MS;
      logger.warn('ML matching unavailable; scoring locally', { error: (error as Error).message });
      return null;
    }
  }

  private scoreLocally(candidates: Candidate[], params: RideSearchParams): MatchScore[] {
    const scores: MatchScore[] = [];

    for (const { ride, driver, pickupDistanceKm } of candidates) {
      try {
        const score = this.computeScore(ride, driver, params, pickupDistanceKm);
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
    /** Distance from the rider's pickup to the route, when known; else to the ride's start */
    routeDistanceKm?: number,
  ): MatchScore {
    // ── Proximity Score (40%) ──
    const pickupDistKm = routeDistanceKm ?? haversineDistanceKm(
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
    // Riders' confidential "did you feel safe?" answers, once there are
    // enough to mean something; until then, how reliably the driver turns up
    const cancellationRate = driver.stats.cancellationRate || 0;
    const felt = driver.safetyRating?.asDriver;
    const safetyScore = felt && felt.count >= 3 ? ((felt.avg - 1) / 4) * 100 : (1 - cancellationRate) * 100;

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
