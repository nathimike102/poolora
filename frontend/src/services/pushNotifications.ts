/**
 * services/pushNotifications.ts
 *
 * Push notifications through Firebase Cloud Messaging. Once signed in, the app
 * asks to show notifications and sends this phone's token to the backend, which
 * uses it for things like "the safety team asked for video" and ride updates.
 * Signing out removes it, so the phone stops getting that account's alerts.
 *
 * Notifications are shown by the system while the app is in the background.
 * In the foreground the open screen already updates over the live connection,
 * and an open SOS shows its own bar (components/ActiveSosBanner).
 */

import { PermissionsAndroid, Platform } from 'react-native';
import {
  AuthorizationStatus,
  deleteToken,
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';

let currentToken: string | null = null;
let stopRefresh: (() => void) | null = null;

async function allowed(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // Android 13 and later ask; earlier versions allow notifications by default
    if (Platform.Version < 33) return true;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await requestPermission(getMessaging());
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

async function save(token: string): Promise<void> {
  await apiClient.put(API_ENDPOINTS.users.pushToken, { token });
  currentToken = token;
}

/** After sign-in: this phone gets the account's push notifications, if the person allows them */
export async function registerForPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!(await allowed())) {
      logger.info('Notifications not allowed on this phone');
      return;
    }
    const messaging = getMessaging();
    await save(await getToken(messaging));
    stopRefresh?.();
    stopRefresh = onTokenRefresh(messaging, (token) => {
      save(token).catch((error) => logger.warn('Could not update the push token', { error }));
    });
  } catch (error) {
    // Pushes are a convenience; the app still works without them
    logger.warn('Could not register for push notifications', { error });
  }
}

/** Before sign-out, while the session can still reach the backend */
export async function unregisterFromPush(): Promise<void> {
  stopRefresh?.();
  stopRefresh = null;
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  try {
    await apiClient.delete(API_ENDPOINTS.users.pushToken, { data: { token } });
  } catch (error) {
    logger.warn('Could not remove the push token', { error });
  }
  // A fresh token next time, so the old one can never reach this account again
  await deleteToken(getMessaging()).catch(() => undefined);
}
