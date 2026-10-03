/**
 * The URL as logged or sent to Sentry. Every /track/ link (SOS, trip,
 * emergency contact, work email) carries its credential in the path, and
 * anyone who can read the logs must not be able to open a live SOS location
 * or confirm someone's address. No imports, so instrument.ts can use it
 * before anything else loads.
 */
const SECRET_PATH = /^((?:[a-z][a-z0-9+.-]*:\/\/[^/]+)?(?:\/api\/v1)?\/track\/[a-z-]+\/)[^/?#]+/i;
const SECRET_QUERY = /((?:^|[?&])(?:token|code|otp|key|hash|signature|secret|password)=)[^&#]*/gi;

export function redactUrl(url: string): string {
  return url.replace(SECRET_PATH, '$1[redacted]').replace(SECRET_QUERY, '$1[redacted]');
}
