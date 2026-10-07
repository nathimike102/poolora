/**
 * utils/position.ts
 *
 * Where the phone is, without waiting forever. On Android a fresh fix can
 * hang for minutes indoors or with GPS asleep, even when the phone already
 * knows roughly where it is; this waits briefly and then takes the phone's
 * last known position. Callers ask for permission first.
 */

import * as Location from 'expo-location';

export interface Fix {
  lat: number;
  lng: number;
}

/** Long enough for a network fix, short enough that a screen doesn't sit on a spinner */
const FIX_TIMEOUT_MS = 8_000;

/**
 * A fresh fix, else the last known position, else null.
 * `maxAgeMs` bounds how old the fallback may be, for uses where a stale
 * position would mislead (a default pickup); leave it out to take any.
 */
export async function quickFix(maxAgeMs?: number, timeoutMs = FIX_TIMEOUT_MS): Promise<Fix | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    .then(p => ({ lat: p.coords.latitude, lng: p.coords.longitude }))
    .catch(() => null);
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  const fix = await Promise.race([fresh, timeout]);
  clearTimeout(timer);
  if (fix) return fix;
  const last = await Location.getLastKnownPositionAsync(maxAgeMs ? { maxAge: maxAgeMs } : undefined).catch(() => null);
  return last ? { lat: last.coords.latitude, lng: last.coords.longitude } : null;
}
