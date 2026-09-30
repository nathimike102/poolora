/**
 * PricingService.ts
 *
 * Suggested seat prices (UC-D02 steps 6-7, UC-AI03). The suggestion comes
 * from the route distance, a per-kilometre rate for the vehicle (roughly its
 * running cost shared between riders), a peak-hour uplift, and surge when
 * the demand forecast is high (+20% to +50%). A driver may set a price
 * within ±30% of the suggestion, and never outside US$0.02 to US$0.20 per km a
 * seat. Rates are pitched against kombi and intercity bus fares, so a 15 km
 * commute costs about a dollar and Harare to Bulawayo about US$25.
 *
 * Checked in September 2026: ZUPCO charges US$0.50 up to 20 km and US$1 up
 * to 40 km, private kombis US$0.50 to US$1, taxi apps (inDrive, Vaya) US$2
 * to US$4 for 5 km, and intercity buses from Harare US$15 to Bulawayo
 * (440 km) or US$35 on a luxury coach. Petrol is about US$2.06 a litre, so a
 * sedan costs roughly US$0.15 a km to run; three riders at the sedan rate
 * cover it.
 */

import { VehicleType } from '../types';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { demandTime, money } from '../config/region';

export const PRICE_RULES = {
  minPerKm: 0.02,
  maxPerKm: 0.2,
  /** How far from the suggestion the driver may go */
  adjustBand: 0.3,
  /** Surge applies only from +20%, and never above +50% (UC-D02 6a) */
  surgeFloor: 1.2,
  surgeCap: 1.5,
  /** Morning and evening commute hours, in Zimbabwe time */
  peakHours: [6, 7, 8, 16, 17, 18],
  peakUplift: 1.1,
  minimumSeatPrice: 1,
} as const;

/** US dollars per km for one seat, by vehicle */
export const RATE_PER_KM: Record<string, number> = {
  [VehicleType.BIKE]: 0.04,
  [VehicleType.AUTO]: 0.045,
  [VehicleType.MINI]: 0.05,
  [VehicleType.HATCHBACK]: 0.05,
  [VehicleType.SEDAN]: 0.06,
  [VehicleType.MINIVAN]: 0.065,
  [VehicleType.PICKUP]: 0.07,
  [VehicleType.SUV]: 0.075,
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

/**
 * Prices are worked in whole cents. Suggestions round to 10 cents under
 * US$5 and to 50 cents above, which are easy to pay and give change for;
 * the band a driver may pick from moves in 10-cent steps.
 */
const cents = (n: number) => Math.round(n * 100);
const roundSuggestion = (n: number) => {
  const step = n >= 5 ? 50 : 10;
  return Math.max(step, Math.round(cents(n) / step) * step) / 100;
};
const tenCentsUp = (n: number) => (Math.ceil(cents(n) / 10) * 10) / 100;
const tenCentsDown = (n: number) => (Math.floor(cents(n) / 10) * 10) / 100;

export class PricingService {
  /**
   * Surge for a place and time, from the demand forecast. 1 when the
   * forecast is unavailable or below the threshold.
   */
  async surgeFor(lat: number, lng: number, departure: Date): Promise<number> {
    try {
      const { hour, weekday, isHoliday } = demandTime(departure);
      const { mlClient } = await import('../utils/mlClient');
      const { data } = await mlClient.post('/api/predict-demand', { lat, lng, hour, day_of_week: weekday, is_holiday: isHoliday }, { timeout: 2000 });
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
    const when = demandTime(input.departureTime);
    // No commute rush on a public holiday
    const peak = !when.isHoliday && (PRICE_RULES.peakHours as readonly number[]).includes(when.hour);
    const surge = await this.surgeFor(input.pickup.lat, input.pickup.lng, input.departureTime);

    const floor = distanceKm * PRICE_RULES.minPerKm;
    const ceiling = distanceKm * PRICE_RULES.maxPerKm;
    const raw = distanceKm * rate * (peak ? PRICE_RULES.peakUplift : 1) * surge;
    // The minimum seat price wins over the per-km ceiling on very short rides
    const suggested = roundSuggestion(Math.min(Math.max(ceiling, PRICE_RULES.minimumSeatPrice), Math.max(floor, PRICE_RULES.minimumSeatPrice, raw)));
    const min = tenCentsUp(Math.max(floor, suggested * (1 - PRICE_RULES.adjustBand)));
    const max = Math.max(suggested, tenCentsDown(Math.min(Math.max(ceiling, suggested), suggested * (1 + PRICE_RULES.adjustBand))));

    const parts = [`${Math.round(distanceKm)} km at about ${money(rate)} a km`];
    if (peak) parts.push('commute hours +10%');
    if (surge > 1) parts.push(`high demand +${Math.round((surge - 1) * 100)}%`);
    return { suggested, min, max, distanceKm, surge, peak, explanation: parts.join(', ') };
  }

  /** Throws when a price is outside what the rules allow for this ride */
  check(price: number, suggestion: PriceSuggestion): void {
    if (price < suggestion.min || price > suggestion.max) {
      throw new AppError(
        `For this route the price per seat must be between ${money(suggestion.min)} and ${money(suggestion.max)} (suggested ${money(suggestion.suggested)}).`,
        422,
        'PRICE_OUT_OF_RANGE',
      );
    }
  }
}
