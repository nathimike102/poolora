import { formatPhone } from './region';

/**
 * Accounts created with Google or email get a `firebase:<uid>` placeholder in
 * the required phone field. Returns the phone only when it is a real number.
 */
export function realPhone(phone?: string | null): string | undefined {
  return phone && !phone.startsWith('firebase:') ? phone : undefined;
}

/** A real phone number in the local display format (+263 77 123 4567), for showing, not for dialling */
export function displayPhone(phone?: string | null): string | undefined {
  const real = realPhone(phone);
  return real ? formatPhone(real) : undefined;
}
