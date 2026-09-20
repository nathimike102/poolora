import { cert, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { config } from './index';
import { logger } from '../utils/logger';
import fs from 'fs';

let firebaseApp: App | null = null;

export function initializeFirebase(): void {
  if (firebaseApp) return;

  try {
    const { serviceAccountJson, serviceAccountPath } = config.firebase as {
      serviceAccountJson?: string;
      serviceAccountPath?: string;
    };

    // Prefer inline JSON (useful for CI / containers where files are not mounted).
    if (serviceAccountJson) {
      let parsed: unknown = serviceAccountJson;
      try {
        // Allow base64-encoded payloads
        if (/^[A-Za-z0-9+/=\n\r]+$/.test(serviceAccountJson.trim())) {
          const decoded = Buffer.from(serviceAccountJson, 'base64').toString('utf8');
          parsed = JSON.parse(decoded);
        } else {
          parsed = JSON.parse(serviceAccountJson);
        }
      } catch {
        // Fall back to raw parse attempt
        parsed = JSON.parse(serviceAccountJson);
      }

      firebaseApp = initializeApp({
        credential: cert(parsed as ServiceAccount),
        projectId: config.firebase.projectId,
        ...(config.firebase.databaseUrl
          ? { databaseURL: config.firebase.databaseUrl }
          : {}),
      });

    } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: config.firebase.projectId,
        ...(config.firebase.databaseUrl
          ? { databaseURL: config.firebase.databaseUrl }
          : {}),
      });

    } else {
      // In development, initialize with project ID only (limited functionality)
      firebaseApp = initializeApp({
        projectId: config.firebase.projectId,
        ...(config.firebase.databaseUrl
          ? { databaseURL: config.firebase.databaseUrl }
          : {}),
      });
    }

    logger.info('Firebase Admin SDK initialized');
  } catch (error) {
    logger.warn('Firebase initialization failed; OTP verification will use fallback', { error });
  }
}

export function getFirebaseAuth(): Auth {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return getAuth(firebaseApp);
}

export function getFirebaseMessaging(): Messaging {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return getMessaging(firebaseApp);
}
