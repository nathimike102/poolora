/**
 * utils/carbon.ts
 *
 * Showing the CO₂ saved by shared trips (UC-R11). The figures come from the
 * backend (CarbonService); this only words them.
 */

import { REGION } from './region';

/** kg of CO₂ from burning a litre of petrol, to make a saving tangible */
export const KG_CO2_PER_LITRE_PETROL = 2.31;

const fmt = (n: number, digits: number) =>
  n.toLocaleString(REGION.dateLocale, { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** "0.8 kg", "42 kg", "1.25 tonnes" */
export function formatKg(kg: number): string {
  if (kg >= 1000) return `${fmt(kg / 1000, 2)} tonnes`;
  return `${fmt(kg, kg < 10 ? 1 : 0)} kg`;
}

/** "12 km", "1,240 km" */
export function formatKm(km: number): string {
  return `${fmt(km, km < 10 ? 1 : 0)} km`;
}

/** Litres of petrol whose burning gives off this much CO₂, rounded to a whole litre */
export function petrolLitres(kg: number): number {
  return Math.round(kg / KG_CO2_PER_LITRE_PETROL);
}

/** "Mar" for "2026-03", in the market's locale */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(REGION.dateLocale, { month: 'short', timeZone: 'UTC' });
}
