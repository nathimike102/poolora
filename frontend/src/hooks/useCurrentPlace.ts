/**
 * hooks/useCurrentPlace.ts
 *
 * The device's position and its street address, used as the default pickup.
 * The result is shared between screens for a few minutes so the home screen
 * and the search screen don't each ask for a fix and an address lookup.
 */

import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

import { reverseGeocodePlace } from '../services/placesService';

export interface CurrentPlace {
  lat: number;
  lng: number;
  /** Null when the address lookup failed; the coordinates are still usable */
  address: string | null;
}

export type CurrentPlaceStatus = 'loading' | 'ready' | 'denied' | 'unavailable';

const CACHE_MS = 5 * 60 * 1000;
let cached: { place: CurrentPlace; at: number } | null = null;
let inFlight: Promise<CurrentPlace> | null = null;

async function locate(): Promise<CurrentPlace> {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude: lat, longitude: lng } = pos.coords;
  let address: string | null = null;
  try {
    address = (await reverseGeocodePlace(lat, lng)).formattedAddress;
  } catch {
    // Keep the coordinates; the UI says "Current location" instead
  }
  return { lat, lng, address };
}

export function useCurrentPlace() {
  const fresh = cached && Date.now() - cached.at < CACHE_MS ? cached.place : null;
  const [place, setPlace] = useState<CurrentPlace | null>(fresh);
  const [status, setStatus] = useState<CurrentPlaceStatus>(fresh ? 'ready' : 'loading');

  const refresh = useCallback(async (force = false) => {
    if (!force && cached && Date.now() - cached.at < CACHE_MS) {
      setPlace(cached.place);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      inFlight ??= locate().finally(() => {
        inFlight = null;
      });
      const next = await inFlight;
      cached = { place: next, at: Date.now() };
      setPlace(next);
      setStatus('ready');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { place, status, refresh };
}
