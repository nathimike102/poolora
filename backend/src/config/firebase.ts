import admin from 'firebase-admin';
import { config } from './index';
import { logger } from '../utils/logger';
import fs from 'fs';

let firebaseApp: admin.app.App | null = null;

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

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(parsed as admin.ServiceAccount),
        projectId: config.firebase.projectId,
      });

    } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebase.projectId,
      });

    } else {
      // In development, initialize with project ID only (limited functionality)
      firebaseApp = admin.initializeApp({
        projectId: config.firebase.projectId,
      });
    }

    logger.info('Firebase Admin SDK initialized');
  } catch (error) {
    logger.warn('Firebase initialization failed — OTP verification will use fallback', { error });
  }
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin.auth(firebaseApp);
}

export function getFirebaseMessaging(): admin.messaging.Messaging {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin.messaging(firebaseApp);
}
