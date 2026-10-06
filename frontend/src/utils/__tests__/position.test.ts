import * as Location from 'expo-location';

import { quickFix } from '../position';

const current = Location.getCurrentPositionAsync as jest.Mock;
const lastKnown = Location.getLastKnownPositionAsync as jest.Mock;
const at = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });

describe('quickFix', () => {
  afterEach(() => {
    jest.useRealTimers();
    current.mockReset().mockResolvedValue(at(12.9352, 77.6245));
    lastKnown.mockReset().mockResolvedValue(null);
  });

  test('uses a fresh fix when one comes quickly', async () => {
    current.mockResolvedValueOnce(at(-17.8, 31.05));
    await expect(quickFix()).resolves.toEqual({ lat: -17.8, lng: 31.05 });
    expect(lastKnown).not.toHaveBeenCalled();
  });

  // Android can sit on a fresh fix for minutes; the home screen showed
  // "Finding your location…" until the app was closed.
  test('falls back to the last known position when the fix hangs', async () => {
    jest.useFakeTimers();
    current.mockReturnValueOnce(new Promise(() => {}));
    lastKnown.mockResolvedValueOnce(at(17.08, 82.14));

    const result = quickFix(5 * 60_000);
    await jest.advanceTimersByTimeAsync(8_000);

    await expect(result).resolves.toEqual({ lat: 17.08, lng: 82.14 });
    expect(lastKnown).toHaveBeenCalledWith({ maxAge: 5 * 60_000 });
  });

  test('gives null when the phone has no position at all', async () => {
    current.mockRejectedValueOnce(new Error('Location services off'));
    await expect(quickFix()).resolves.toBeNull();
  });
});
