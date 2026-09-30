/**
 * utils/region.ts
 *
 * The markets Poolora runs in, and the one this build serves (set with
 * EXPO_PUBLIC_MARKET, default ZW). Money, phone numbers, dates, the default
 * map position and emergency numbers all come from here, so nothing else
 * hard-codes a country. Zimbabwe is the first market. Mirrors
 * backend/src/config/region.ts.
 */

export type CurrencyCode = 'USD' | 'ZWG';

export interface Market {
  country: string;
  countryName: string;
  dialCode: string;
  /** The national part of a mobile number, without the leading 0 */
  mobilePattern: RegExp;
  /** How a national number is shown as a placeholder */
  phonePlaceholder: string;
  /** Digit groups for showing a national number, e.g. [2, 3, 4] → 77 123 4567 */
  phoneGroups: number[];
  /** Locale for dates and times */
  dateLocale: string;
  currency: CurrencyCode;
  center: { latitude: number; longitude: number };
  emergency: { general: string; police: string; ambulance: string; fire: string };
}

export const MARKETS: Record<string, Market> = {
  ZW: {
    country: 'ZW',
    countryName: 'Zimbabwe',
    dialCode: '+263',
    // Econet 77/78, NetOne 71, Telecel 73
    mobilePattern: /^7[1378]\d{7}$/,
    phonePlaceholder: '77 123 4567',
    phoneGroups: [2, 3, 4],
    // Day-month order and a 24-hour clock, as dates are written there
    dateLocale: 'en-GB',
    currency: 'USD',
    // Harare
    center: { latitude: -17.8292, longitude: 31.0522 },
    emergency: { general: '999', police: '995', ambulance: '994', fire: '993' },
  },
};

/** The market this build serves; an unknown code falls back to Zimbabwe */
export const REGION: Market = MARKETS[(process.env.EXPO_PUBLIC_MARKET || 'ZW').toUpperCase()] ?? MARKETS.ZW;

const SYMBOL: Record<CurrencyCode, string> = { USD: 'US$', ZWG: 'ZiG ' };

/** The market currency's symbol, for input labels: "US$" */
export const currencySymbol = (currency: CurrencyCode = REGION.currency) => SYMBOL[currency].trim();

/** "US$12", "US$12.50", "ZiG 340.25" */
export function money(amount: number, currency: CurrencyCode = REGION.currency): string {
  const n = Math.round(amount * 100) / 100;
  const fraction = Number.isInteger(n) ? 0 : 2;
  return `${n < 0 ? '-' : ''}${SYMBOL[currency]}${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: 2,
  })}`;
}

/** The national digits a person typed, without a leading 0 or country code */
export function nationalDigits(input: string): string {
  let digits = input.replace(/\D/g, '');
  const country = REGION.dialCode.slice(1);
  if (digits.startsWith(country)) digits = digits.slice(country.length);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/**
 * A mobile number in this market in E.164. In Zimbabwe: 0771 234 567,
 * 771234567, 263771234567 or +263 77 123 4567 all give +263771234567.
 * Null for anything else.
 */
export function toE164(input: string): string | null {
  const digits = nationalDigits(input);
  return REGION.mobilePattern.test(digits) ? `${REGION.dialCode}${digits}` : null;
}

/** +263771234567 → "+263 77 123 4567"; numbers from elsewhere are left as they are */
export function formatPhone(e164: string): string {
  if (!e164.startsWith(REGION.dialCode)) return e164;
  const national = e164.slice(REGION.dialCode.length);
  if (national.length !== REGION.phoneGroups.reduce((a, b) => a + b, 0)) return e164;
  const parts: string[] = [];
  let at = 0;
  for (const size of REGION.phoneGroups) {
    parts.push(national.slice(at, at + size));
    at += size;
  }
  return `${REGION.dialCode} ${parts.join(' ')}`;
}

/** Keeps what someone types into a money field to digits and up to two decimals: "12.5" */
export function moneyInput(text: string): string {
  const [whole, ...rest] = text.replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}
