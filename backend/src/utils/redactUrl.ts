/**
 * The URL as logged or sent to Sentry. SOS, trip and emergency-contact links
 * carry their credential in the path, and anyone who can read the logs must
 * not be able to open a live SOS location. No imports, so instrument.ts can
 * use it before anything else loads.
 */
const SECRET_PATH = /^((?:[a-z][a-z0-9+.-]*:\/\/[^/]+)?(?:\/api\/v1)?\/track\/(?:sos|trip|contact)\/)[^/?#]+/i;
const SECRET_QUERY = /((?:^|[?&])(?:token|code|otp|key|hash|signature|secret|password)=)[^&#]*/gi;

export function redactUrl(url: string): string {
  return url.replace(SECRET_PATH, '$1[redacted]').replace(SECRET_QUERY, '$1[redacted]');
}
