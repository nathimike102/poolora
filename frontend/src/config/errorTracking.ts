/**
 * config/errorTracking.ts
 *
 * Crash and error reporting with Sentry. Disabled unless SENTRY_DSN is set in
 * .env. No personal data (names, phone numbers, locations) is attached.
 */

import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '@env';

let enabled = false;

export function initErrorTracking(): void {
  if (!SENTRY_DSN || __DEV__) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeBreadcrumb(breadcrumb) {
      // HTTP breadcrumbs can carry query strings with coordinates or phone numbers
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') return null;
      return breadcrumb;
    },
  });
  enabled = true;
}

export function reportError(error: unknown, context?: Record<string, string>): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { tags: context } : undefined);
}
