jest.mock('../../api/axios', () => ({ apiClient: { post: jest.fn() } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiClient } from '../../api/axios';
import { TRIP_LOCATION_TASK, startTripTracking, stopTripTracking } from '../tripTracking';

type TaskBody = (args: { data?: { locations: Array<{ coords: Record<string, number | null> }> }; error?: unknown }) => Promise<void>;
const runTask = (TaskManager.defineTask as jest.Mock).mock.calls.find(([name]) => name === TRIP_LOCATION_TASK)[1] as TaskBody;
const fix = (latitude: number, longitude: number) => ({ locations: [{ coords: { latitude, longitude, speed: 10, heading: 90, accuracy: 5 } }] });

describe('trip tracking', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(false);
  });

  it('sends the car every 5 s and a rider every 15 s, as a foreground service', async () => {
    await startTripTracking('ride1', 'driver');
    expect(Location.startLocationUpdatesAsync).toHaveBeenLastCalledWith(TRIP_LOCATION_TASK, expect.objectContaining({ timeInterval: 5000 }));
    await startTripTracking('ride2', 'rider');
    expect(Location.startLocationUpdatesAsync).toHaveBeenLastCalledWith(TRIP_LOCATION_TASK, expect.objectContaining({
      timeInterval: 15000,
      foregroundService: expect.objectContaining({ notificationTitle: 'Ride in progress' }),
    }));
  });

  it('posts the position with speed in km/h and the battery, and stops when the server says so', async () => {
    await AsyncStorage.setItem('@siham_active_trip', 'ride1');
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(true);
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { data: { tracking: true } } });
    await runTask({ data: fix(-17.8, 31.05) });
    expect(apiClient.post).toHaveBeenCalledWith('/rides/ride1/position', {
      location: { lat: -17.8, lng: 31.05 }, speed: 36, heading: 90, accuracy: 5, battery: 0.8,
    }, { noRetry: true });

    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { data: { tracking: false } } });
    await runTask({ data: fix(-17.8, 31.05) });
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(TRIP_LOCATION_TASK);
  });

  it('another ride\'s screen never stops the ride being tracked', async () => {
    await AsyncStorage.setItem('@siham_active_trip', 'ride1');
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(true);
    await stopTripTracking('ride9');
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    await stopTripTracking('ride1');
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
  });
});
