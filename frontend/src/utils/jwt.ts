/**
 * utils/jwt.ts
 *
 * Minimal JWT helpers for client-side expiry handling.
 * We only decode (no signature verification) to read the `exp` claim.
 */

type JwtPayload = {
  exp?: number; // seconds since epoch
};

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLength);

  // React Native supports atob in modern runtimes
  if (typeof atob === 'function') {
    return atob(padded);
  }

  throw new Error('atob is not available in this environment');
}

export function getJwtExpiresAtMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as JwtPayload;
    if (!payload.exp) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

