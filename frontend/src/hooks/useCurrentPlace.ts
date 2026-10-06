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
import { quickFix } from '../utils/position';

export interface CurrentPlace {
  lat: number;
  lng: number;
  /** Null when the address lookup failed; the coordinates are still usable */
  address: string | null;
}

export type CurrentPlaceStatus = 'loading' | 'ready' | 'denied' | 'unavailable';

const CACHE_MS = 5 * 60 * 1000;
/** An older last-known position could put the pickup somewhere the rider left */
const PICKUP_MAX_AGE_MS = 5 * 60 * 1000;
let cached: { place: CurrentPlace; at: number } | null = null;
let inFlight: Promise<CurrentPlace> | null = null;

async function locate(): Promise<CurrentPlace> {
  const fix = await quickFix(PICKUP_MAX_AGE_MS);
  if (!fix) throw new Error('No position');
  const { lat, lng } = fix;
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
  // An older position shows straight away while a fresh one is found; the
  // status stays 'loading' until then, and the place updates when it arrives
  const [place, setPlace] = useState<CurrentPlace | null>(cached?.place ?? null);
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
