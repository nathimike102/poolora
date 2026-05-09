/**
 * config/env.ts
 *
 * Centralized access to all environment variables.
 * Import from here instead of '@env' directly so that
 * every variable is validated in one place.
 */

import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_WEB_CLIENT_ID,
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  EAS_PROJECT_ID,
} from '@env';

export const env = {
  // Google
  GOOGLE_MAPS_API_KEY,
  GOOGLE_WEB_CLIENT_ID,

  // Firebase
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,

  // EAS / Expo
  EAS_PROJECT_ID,
} as const;
