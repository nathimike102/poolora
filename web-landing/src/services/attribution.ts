/**
 * Captures the UTM parameters and referrer from the first page the visitor
 * lands on and keeps them for the session, so a form submitted three pages
 * later still carries the campaign that brought the person here.
 *
 * Stored in sessionStorage, which is cleared when the tab closes. Nothing here
 * identifies a person, so it runs without a consent prompt; analytics that do
 * identify people are gated separately in `consent.ts`.
 */

const STORAGE_KEY = 'poolora.attribution';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
] as const;

export type AttributionKey = (typeof UTM_KEYS)[number] | 'referrer' | 'landing_page';

export type Attribution = Partial<Record<AttributionKey, string>>;

function read(): Attribution {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

/**
 * Records attribution once per session. Safe to call on every page load: an
 * existing record is never overwritten by a later, emptier one.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;

  const existing = read();
  if (Object.keys(existing).length > 0) return;

  const params = new URLSearchParams(window.location.search);
  const captured: Attribution = {};

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) captured[key] = value.slice(0, 200);
  }

  if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
    captured.referrer = document.referrer.slice(0, 500);
  }
  captured.landing_page = `${window.location.pathname}${window.location.search}`.slice(0, 500);

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
  } catch {
    // Private browsing or storage disabled. Attribution is best effort.
  }
}

export function getAttribution(): Attribution {
  return read();
}
