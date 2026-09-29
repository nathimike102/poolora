/**
 * region.ts
 *
 * The markets Poolora runs in, and the one this deployment serves. Time
 * zone, phone numbers, money, map bounds and emergency numbers all come
 * from here, so nothing else hard-codes a country. Zimbabwe is the first
 * market; a new country is a new entry in MARKETS (and its payment
 * provider), then MARKET=<code> for its deployment.
 *
 * Mirrors frontend/src/utils/region.ts.
 */

export type CurrencyCode = 'USD' | 'ZWG';

export interface Market {
  /** ISO 3166-1 alpha-2 */
  country: string;
  countryName: string;
  locale: string;
  /** IANA zone, used for formatting and for $dateTrunc in reports */
  timeZone: string;
  /** Shown next to times, e.g. "14:30 CAT" */
  timeZoneLabel: string;
  /**
   * Fixed offset used to find local days and hours. Exact only in countries
   * without daylight saving; a market with it needs Intl-based day maths.
   */
  utcOffsetMs: number;
  dialCode: string;
  /** The national part of a mobile number, without the leading 0 */
  mobilePattern: RegExp;
  examplePhone: string;
  /** Prices, wallets and reports are kept in this currency */
  currency: CurrencyCode;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: readonly [number, number, number, number];
  center: { lat: number; lng: number };
  emergency: { general: string; police: string; ambulance: string; fire: string };
}

export const MARKETS: Record<string, Market> = {
  ZW: {
    country: 'ZW',
    countryName: 'Zimbabwe',
    locale: 'en-ZW',
    timeZone: 'Africa/Harare',
    timeZoneLabel: 'CAT',
    // Central Africa Time all year, no daylight saving
    utcOffsetMs: 2 * 3_600_000,
    dialCode: '+263',
    // Econet 77/78, NetOne 71, Telecel 73
    mobilePattern: /^7[1378]\d{7}$/,
    examplePhone: '+263771234567',
    // US dollars; ZiG is a way to pay (config.zwgPerUsd)
    currency: 'USD',
    bbox: [25.2, -22.5, 33.1, -15.6],
    // Harare
    center: { lat: -17.8292, lng: 31.0522 },
    emergency: { general: '999', police: '995', ambulance: '994', fire: '993' },
  },
};

function selectMarket(code = process.env.MARKET || 'ZW'): Market {
  const market = MARKETS[code.toUpperCase()];
  if (!market) throw new Error(`Unknown MARKET "${code}". Known: ${Object.keys(MARKETS).join(', ')}`);
  return market;
}

/** The market this deployment serves */
export const REGION: Market = selectMarket();

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
 * Normalises a mobile number in this market to E.164. In Zimbabwe it
 * accepts 0771 234 567, 771234567, 263771234567 or +263 77 123 4567, all
 * giving +263771234567. Returns null
 * for anything else.
 */
export function toE164(input: string): string | null {
  let digits = input.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  const country = REGION.dialCode.slice(1);
  if (digits.startsWith(country)) digits = digits.slice(country.length);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return REGION.mobilePattern.test(digits) ? `${REGION.dialCode}${digits}` : null;
}
