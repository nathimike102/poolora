/**
 * region.ts
 *
 * The country Poolora runs in: Zimbabwe. Time zone, phone numbers, money,
 * map bounds and emergency numbers all come from here, so nothing else
 * hard-codes a country.
 *
 * Zimbabwe keeps Central Africa Time (UTC+2) all year with no daylight
 * saving, so a fixed offset gives exact local days and hours.
 */

export type CurrencyCode = 'USD' | 'ZWG';

export const REGION = {
  country: 'ZW',
  countryName: 'Zimbabwe',
  locale: 'en-ZW',
  timeZone: 'Africa/Harare',
  /** Shown next to times, e.g. "14:30 CAT" */
  timeZoneLabel: 'CAT',
  utcOffsetMs: 2 * 3_600_000,
  dialCode: '+263',
  /** The national part of a mobile number: Econet 77/78, NetOne 71, Telecel 73 */
  mobilePattern: /^7[1378]\d{7}$/,
  examplePhone: '+263771234567',
  /** Prices, wallets and reports are kept in US dollars; ZiG is a way to pay */
  currency: 'USD' as CurrencyCode,
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [25.2, -22.5, 33.1, -15.6] as const,
  /** Harare */
  center: { lat: -17.8292, lng: 31.0522 },
  emergency: { general: '999', police: '995', ambulance: '994', fire: '993' },
} as const;

const SYMBOL: Record<CurrencyCode, string> = { USD: 'US$', ZWG: 'ZiG ' };

/** Rounds to cents, the smallest unit both currencies use */
export const roundMoney = (n: number) => Math.round(n * 100) / 100;

/** "US$12", "US$12.50", "ZiG 340.25" */
export function money(amount: number, currency: CurrencyCode = REGION.currency): string {
  const n = roundMoney(amount);
  const fraction = Number.isInteger(n) ? 0 : 2;
  return `${n < 0 ? '-' : ''}${SYMBOL[currency]}${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: 2,
  })}`;
}

/** A plain number as people here write it: 1,234.5 */
export const number = (n: number, maxFractionDigits = 2) =>
  n.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });

/** Formats a date in Zimbabwe time */
export function localTime(date: Date | string | number, options: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString('en-GB', { timeZone: REGION.timeZone, ...options });
}

/**
 * The instant shifted so its UTC fields read as Zimbabwe wall-clock time.
 * Use getUTCHours() etc. on the result; shift back with `fromLocalClock`.
 */
export const toLocalClock = (date: Date) => new Date(date.getTime() + REGION.utcOffsetMs);
export const fromLocalClock = (date: Date) => new Date(date.getTime() - REGION.utcOffsetMs);

/**
 * Normalises a Zimbabwe mobile number to E.164 (+2637XXXXXXXX). Accepts
 * 0771 234 567, 771234567, 263771234567 or +263 77 123 4567. Returns null
 * for anything else.
 */
export function toE164(input: string): string | null {
  let digits = input.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('263')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return REGION.mobilePattern.test(digits) ? `${REGION.dialCode}${digits}` : null;
}
