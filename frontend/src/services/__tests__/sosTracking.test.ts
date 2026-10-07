jest.mock('../../api/axios', () => ({ apiClient: { post: jest.fn() } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiClient } from '../../api/axios';
import { SOS_LOCATION_TASK, startSosTracking } from '../sosTracking';

type TaskBody = (args: { data?: { locations: Array<{ coords: { latitude: number; longitude: number } }> }; error?: unknown }) => Promise<void>;
// The task is defined when the module loads; keep the body to call it like the system would
const runTask = (TaskManager.defineTask as jest.Mock).mock.calls.find(([name]) => name === SOS_LOCATION_TASK)[1] as TaskBody;
const at = (latitude: number, longitude: number) => ({ locations: [{ coords: { latitude: 0, longitude: 0 } }, { coords: { latitude, longitude } }] });

describe('SOS background tracking', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('starts a foreground service that sends every 5 seconds, remembering the SOS', async () => {
    expect(await startSosTracking('sos1')).toBe(true);
    expect(await AsyncStorage.getItem('@siham_active_sos')).toBe('sos1');
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(SOS_LOCATION_TASK, expect.objectContaining({
      timeInterval: 5000,
      foregroundService: expect.objectContaining({ notificationTitle: 'SOS active' }),
    }));
  });

  it('sends the latest position, and stops itself once the SOS is closed', async () => {
    await AsyncStorage.setItem('@siham_active_sos', 'sos1');
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(true);
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { data: { open: true } } });
    await runTask({ data: at(-17.8, 31.05) });
    expect(apiClient.post).toHaveBeenCalledWith('/safety/sos/sos1/location', { location: { lat: -17.8, lng: 31.05 }, battery: 0.8 });
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();

    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { data: { open: false } } });
    await runTask({ data: at(-17.81, 31.06) });
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(SOS_LOCATION_TASK);
    expect(await AsyncStorage.getItem('@siham_active_sos')).toBeNull();
  });

  it('keeps going when a position cannot be sent (no signal)', async () => {
    await AsyncStorage.setItem('@siham_active_sos', 'sos1');
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    await runTask({ data: at(-17.8, 31.05) });
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });
});
