/**
 * services/tripTracking.ts
 *
 * Every phone on a ride sends its position while the ride is under way
 * (decided 30 September 2026): the driver's (the car) every 5 seconds from
 * the start, and each rider's every 15 seconds from pickup to drop. It runs
 * as a background task, so the car stays on the riders' maps and in the
 * trip trail when the driver opens Maps or locks the phone, and a rider is
 * traced even if separated from the car.
 *
 * On Android it is a foreground service with a "Ride in progress"
 * notification; it needs only the "while using the app" permission. The
 * server says when to stop (the ride ended, or the rider was dropped).
 * The trail is kept 30 days, or with any SOS, safety report or dispute.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';
import { batteryLevel } from '../utils/battery';
import { logger } from '../utils/logger';
import i18n from '../i18n';

export const TRIP_LOCATION_TASK = 'siham-trip-location';
const ACTIVE_TRIP_KEY = '@siham_active_trip';

type Role = 'driver' | 'rider';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRIP_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const rideId = await AsyncStorage.getItem(ACTIVE_TRIP_KEY).catch(() => null);
  if (!rideId) {
    await stopTripTracking();
    return;
  }
  const latest = data.locations[data.locations.length - 1];
  try {
    const response = await apiClient.post<ApiResponse<{ tracking: boolean }>>(API_ENDPOINTS.rides.position(rideId), {
      location: { lat: latest.coords.latitude, lng: latest.coords.longitude },
      speed: latest.coords.speed != null && latest.coords.speed >= 0 ? latest.coords.speed * 3.6 : undefined,
      heading: latest.coords.heading != null && latest.coords.heading >= 0 ? latest.coords.heading : undefined,
      accuracy: latest.coords.accuracy ?? undefined,
      battery: await batteryLevel(),
    }, { noRetry: true });
    if (response.data.data?.tracking === false) await stopTripTracking();
  } catch (err) {
    // No signal: the next fix tries again
    logger.debug('Trip position not sent', { error: err });
  }
});

/**
 * Starts sending for this ride. Returns false when the phone will not allow
 * it; the ride screens then send while they are open, as before.
 */
export async function startTripTracking(rideId: string, role: Role): Promise<boolean> {
  try {
    const current = await AsyncStorage.getItem(ACTIVE_TRIP_KEY).catch(() => null);
    const running = await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK).catch(() => false);
    if (running && current === rideId) return true;
    if (running) await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK);
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return false;
    await AsyncStorage.setItem(ACTIVE_TRIP_KEY, rideId);
    await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
      accuracy: role === 'driver' ? Location.Accuracy.High : Location.Accuracy.Balanced,
      timeInterval: role === 'driver' ? 5_000 : 15_000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: i18n.t('tracking.rideTitle'),
        notificationBody: role === 'driver' ? i18n.t('tracking.rideDriver') : i18n.t('tracking.rideRider'),
        notificationColor: '#0B7A75',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (error) {
    logger.warn('Could not start trip tracking', { error });
    return false;
  }
}

/** Stops sending; with a ride id, only if that is the ride being sent for (another ride's screen never stops it) */
export async function stopTripTracking(rideId?: string): Promise<void> {
  if (rideId) {
    const current = await AsyncStorage.getItem(ACTIVE_TRIP_KEY).catch(() => null);
    if (current && current !== rideId) return;
  }
  await AsyncStorage.removeItem(ACTIVE_TRIP_KEY).catch(() => undefined);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK);
    }
  } catch (error) {
    logger.debug('Trip tracking was not running', { error });
  }
}
