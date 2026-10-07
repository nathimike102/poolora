/**
 * services/locationCountry.ts
 *
 * Which country the phone is in, worked out at start-up before anyone signs
 * in: from the position when location is allowed, otherwise from the phone's
 * region setting. It picks the default calling code at sign-in, and tells the
 * app when rides cannot be booked or offered here because Siham has not
 * launched in this country yet.
 *
 * A test server (one that allows ride simulation; production never does) lets
 * rides through anywhere, so the app can be tried from outside the market.
 */

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getLocales } from 'expo-localization';
import { countryByCode, isServedCountry } from '../utils/countries';
import { simulationService } from './simulationService';

export interface LocationCountry {
  /** ISO code, e.g. "ZW"; undefined until known */
  code?: string;
  /** How it was found: the position, the phone's region setting, or the last time */
  source: 'location' | 'device' | 'saved' | 'none';
  /** The server is a test server, so rides are allowed anywhere; undefined until asked (needs sign-in) */
  testServer?: boolean;
}

const KEY = '@siham_location_country';
let state: LocationCountry = { source: 'none' };
const listeners = new Set<() => void>();

function set(next: Partial<LocationCountry>) {
  state = { ...state, ...next };
  listeners.forEach(l => l());
}

const deviceRegion = (): string | undefined => getLocales()[0]?.regionCode ?? undefined;

/** The country from the position, if location is allowed and a fix is to hand */
async function fromPosition(): Promise<string | undefined> {
  const position = (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 }))
    ?? (await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
    ]));
  if (!position) return undefined;
  const [place] = await Location.reverseGeocodeAsync(position.coords);
  return place?.isoCountryCode ?? undefined;
}

let running: Promise<void> | undefined;

/**
 * Works the country out again. Safe to call often: calls made while one is
 * running share it. Never asks for permission; LocationIntroScreen does that.
 */
export function detectCountry(): Promise<void> {
  running ??= (async () => {
    try {
      if (!state.code) {
        const saved = await AsyncStorage.getItem(KEY).catch(() => null);
        if (saved && countryByCode(saved)) set({ code: saved, source: 'saved' });
        else if (countryByCode(deviceRegion())) set({ code: deviceRegion()!.toUpperCase(), source: 'device' });
      }
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const code = (await fromPosition())?.toUpperCase();
      if (code && countryByCode(code)) {
        set({ code, source: 'location' });
        AsyncStorage.setItem(KEY, code).catch(() => undefined);
      }
    } catch {
      // No fix or no geocoder: keep what is known
    } finally {
      running = undefined;
    }
  })();
  return running;
}

let asked: Promise<void> | undefined;

/**
 * Asks once whether the server is a test server. Needs a signed-in user, so
 * the screens behind sign-in call it, not start-up.
 */
export function checkTestServer(): Promise<void> {
  asked ??= simulationService.isEnabled().then(testServer => set({ testServer }));
  return asked;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The phone's country as known now, for code outside components */
export const getLocationCountry = (): LocationCountry => state;

/** The phone's country, updating when it is found */
export const useLocationCountry = (): LocationCountry => useSyncExternalStore(subscribe, () => state);

/**
 * Whether rides can be booked and offered where the phone is: true in a
 * launched country, while the country is unknown (no one is blocked on a
 * guess) and on a test server; undefined while it is still being checked.
 */
export function ridesAvailable(country: LocationCountry): boolean | undefined {
  if (!country.code || isServedCountry(country.code)) return true;
  return country.testServer;
}

/** For tests */
export const __setLocationCountry = (next: Partial<LocationCountry>) => {
  asked = Promise.resolve();
  set(next);
};
