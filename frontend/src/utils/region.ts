/**
 * utils/region.ts
 *
 * The country the app runs in: Zimbabwe. Money, phone numbers, dates, the
 * default map position and emergency numbers all come from here. Mirrors
 * backend/src/config/region.ts.
 */

export type CurrencyCode = 'USD' | 'ZWG';

export const REGION = {
  country: 'ZW',
  countryName: 'Zimbabwe',
  dialCode: '+263',
  /** Econet 77/78, NetOne 71, Telecel 73: the part after +263 */
  mobilePattern: /^7[1378]\d{7}$/,
  /** How a national number is shown as a placeholder */
  phonePlaceholder: '77 123 4567',
  /** Day-month order and a 24-hour clock, as dates are written here */
  dateLocale: 'en-GB',
  currency: 'USD' as CurrencyCode,
  /** Harare */
  center: { latitude: -17.8292, longitude: 31.0522 },
  emergency: { general: '999', police: '995', ambulance: '994', fire: '993' },
} as const;

const SYMBOL: Record<CurrencyCode, string> = { USD: 'US$', ZWG: 'ZiG ' };

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
  if (digits.startsWith('263')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/**
 * A Zimbabwe mobile number in E.164 (+2637XXXXXXXX), from 0771 234 567,
 * 771234567, 263771234567 or +263 77 123 4567. Null for anything else.
 */
export function toE164(input: string): string | null {
  const digits = nationalDigits(input);
  return REGION.mobilePattern.test(digits) ? `${REGION.dialCode}${digits}` : null;
}

/** +263771234567 → "+263 77 123 4567" */
export function formatPhone(e164: string): string {
  const m = /^\+263(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+263 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Keeps what someone types into a money field to digits and up to two decimals: "12.5" */
export function moneyInput(text: string): string {
  const [whole, ...rest] = text.replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}
