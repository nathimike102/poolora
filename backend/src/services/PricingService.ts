/**
 * PricingService.ts
 *
 * Suggested seat prices (UC-D02 steps 6-7, UC-AI03). The suggestion comes
 * from the route distance, a per-kilometre rate for the vehicle (roughly its
 * running cost shared between riders), a peak-hour uplift, and surge when
 * the demand forecast is high (+20% to +50%). A driver may set a price
 * within ±30% of the suggestion, and never outside ₹2 to ₹15 per km a seat.
 */

import { VehicleType } from '../types';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export const PRICE_RULES = {
  minPerKm: 2,
  maxPerKm: 15,
  /** How far from the suggestion the driver may go */
  adjustBand: 0.3,
  /** Surge applies only from +20%, and never above +50% (UC-D02 6a) */
  surgeFloor: 1.2,
  surgeCap: 1.5,
  /** Morning and evening commute hours, in India time */
  peakHours: [7, 8, 9, 17, 18, 19],
  peakUplift: 1.1,
  minimumSeatPrice: 20,
} as const;

/** Rupees per km for one seat, by vehicle */
const RATE_PER_KM: Record<string, number> = {
  [VehicleType.BIKE]: 2.5,
  [VehicleType.AUTO]: 3,
  [VehicleType.MINI]: 3.5,
  [VehicleType.HATCHBACK]: 3.5,
  [VehicleType.SEDAN]: 4,
  [VehicleType.SUV]: 5,
};

export interface PriceSuggestion {
  suggested: number;
  min: number;
  max: number;
  distanceKm: number;
  surge: number;
  peak: boolean;
  /** Why the number is what it is, for the driver */
  explanation: string;
}

const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

function istParts(date: Date): { hour: number; weekday: number } {
  const ist = new Date(date.getTime() + 5.5 * 3_600_000);
  // The ML service counts weekdays from Monday = 0
  return { hour: ist.getUTCHours(), weekday: (ist.getUTCDay() + 6) % 7 };
}

export class PricingService {
  /**
   * Surge for a place and time, from the demand forecast. 1 when the
   * forecast is unavailable or below the threshold.
   */
  async surgeFor(lat: number, lng: number, departure: Date): Promise<number> {
    try {
      const { hour, weekday } = istParts(departure);
      const { mlClient } = await import('../utils/mlClient');
      const { data } = await mlClient.post('/api/predict-demand', { lat, lng, hour, day_of_week: weekday }, { timeout: 2000 });
      const multiplier = Number((data as { surge_multiplier?: number }).surge_multiplier);
      if (!Number.isFinite(multiplier) || multiplier < PRICE_RULES.surgeFloor) return 1;
      return Math.min(multiplier, PRICE_RULES.surgeCap);
    } catch (error) {
      logger.debug('Demand forecast unavailable for pricing', { error: (error as Error).message });
      return 1;
    }
  }

  async suggest(input: { distanceKm: number; vehicleType?: string; departureTime: Date; pickup: { lat: number; lng: number } }): Promise<PriceSuggestion> {
    const distanceKm = Math.max(1, input.distanceKm);
    const rate = RATE_PER_KM[input.vehicleType ?? VehicleType.SEDAN] ?? RATE_PER_KM[VehicleType.SEDAN];
    const peak = (PRICE_RULES.peakHours as readonly number[]).includes(istParts(input.departureTime).hour);
    const surge = await this.surgeFor(input.pickup.lat, input.pickup.lng, input.departureTime);

    const floor = distanceKm * PRICE_RULES.minPerKm;
    const ceiling = distanceKm * PRICE_RULES.maxPerKm;
    const raw = distanceKm * rate * (peak ? PRICE_RULES.peakUplift : 1) * surge;
    const suggested = roundTo5(Math.min(ceiling, Math.max(floor, PRICE_RULES.minimumSeatPrice, raw)));
    const min = Math.ceil(Math.max(floor, suggested * (1 - PRICE_RULES.adjustBand)));
    const max = Math.floor(Math.min(ceiling, suggested * (1 + PRICE_RULES.adjustBand)));

    const parts = [`${Math.round(distanceKm)} km at about ₹${rate} a km`];
    if (peak) parts.push('commute hours +10%');
    if (surge > 1) parts.push(`high demand +${Math.round((surge - 1) * 100)}%`);
    return { suggested, min, max, distanceKm, surge, peak, explanation: parts.join(', ') };
  }

  /** Throws when a price is outside what the rules allow for this ride */
  check(price: number, suggestion: PriceSuggestion): void {
    if (price < suggestion.min || price > suggestion.max) {
      throw new AppError(
        `For this route the price per seat must be between ₹${suggestion.min} and ₹${suggestion.max} (suggested ₹${suggestion.suggested}).`,
        422,
        'PRICE_OUT_OF_RANGE',
      );
    }
  }
}
