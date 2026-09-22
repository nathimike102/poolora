/**
 * Accounts created with Google or email get a `firebase:<uid>` placeholder in
 * the required phone field. Returns the phone only when it is a real number.
 */
export function realPhone(phone?: string | null): string | undefined {
  return phone && !phone.startsWith('firebase:') ? phone : undefined;
}
