/**
 * Which browser origins may call the API.
 */
import { config } from '../config';

// The API's own pages (the /track confirmation forms) post back to it. That is
// same-origin, not cross-origin, so it is allowed whatever CORS_ORIGIN lists.
function ownOrigin(): string {
  try {
    return new URL(config.app.baseUrl).origin;
  } catch {
    return '';
  }
}

export function corsOriginAllowed(origin: string | undefined): boolean {
  // No Origin header: the mobile app and server-to-server calls
  if (!origin) return true;
  // In development, localhost and 127.0.0.1 on any port, so local tools can call the API
  if (!config.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return origin === ownOrigin() || config.cors.origin.includes(origin);
}
