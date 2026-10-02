/**
 * services/sosTracking.ts
 *
 * Keeps sending the phone's position during an SOS when Poolora is in the
 * background or the screen is locked: a phone in a pocket is the common
 * case in a real emergency (UC-R07 step 7).
 *
 * On Android it runs as a foreground service with a visible notification
 * ("SOS active"), which needs only the "while using the app" location
 * permission the app already has, not background location. On iOS it
 * continues updates the app started while open (the blue location pill).
 * It must be started while the SOS screen is open, and it stops itself
 * as soon as the server says the SOS is closed.
 *
 * The task is defined when this module is imported, which App.tsx does at
 * start-up so the task exists when the system wakes the app for it.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';
import { logger } from '../utils/logger';
import { batteryLevel } from '../utils/battery';
import i18n from '../i18n';

export const SOS_LOCATION_TASK = 'poolora-sos-location';
const ACTIVE_SOS_KEY = '@poolora_active_sos';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(SOS_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const emergencyId = await AsyncStorage.getItem(ACTIVE_SOS_KEY).catch(() => null);
  if (!emergencyId) {
    await stopSosTracking();
    return;
  }
  const latest = data.locations[data.locations.length - 1];
  try {
    const response = await apiClient.post<ApiResponse<{ open?: boolean }>>(API_ENDPOINTS.safety.updateSosLocation(emergencyId), {
      location: { lat: latest.coords.latitude, lng: latest.coords.longitude },
      // Tells a flat battery from a phone switched off, if it goes quiet
      battery: await batteryLevel(),
    });
    if (response.data.data?.open === false) await stopSosTracking();
  } catch (err) {
    // No signal: the next update tries again
    logger.debug('SOS background position not sent', { error: err });
  }
});

/**
 * Starts sending positions for this SOS every 5 seconds, in the foreground
 * and the background. Returns false when the phone would not allow it; the
 * SOS screen then sends positions itself while it is open.
 */
export async function startSosTracking(emergencyId: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(ACTIVE_SOS_KEY, emergencyId);
    if (await Location.hasStartedLocationUpdatesAsync(SOS_LOCATION_TASK).catch(() => false)) return true;
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return false;
    await Location.startLocationUpdatesAsync(SOS_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5_000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: i18n.t('tracking.sosTitle'),
        notificationBody: i18n.t('tracking.sosBody'),
        notificationColor: '#B71C1C',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (error) {
    logger.warn('Could not start SOS background tracking', { error });
    return false;
  }
}

export async function stopSosTracking(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_SOS_KEY).catch(() => undefined);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(SOS_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(SOS_LOCATION_TASK);
    }
  } catch (error) {
    logger.debug('SOS background tracking was not running', { error });
  }
}

/** Whether background tracking is running now (the SOS screen falls back to its own timer when not) */
export function isSosTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(SOS_LOCATION_TASK).catch(() => false);
}
