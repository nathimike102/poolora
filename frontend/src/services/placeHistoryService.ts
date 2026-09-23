/**
 * services/placeHistoryService.ts
 *
 * Places the rider searched for recently, and the ones they marked as
 * favourites, stored on this device. Favourites are kept until unmarked;
 * other places drop off once there are more than MAX_RECENT of them.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@poolora_place_history';
const MAX_RECENT = 6;

export interface HistoryPlace {
  /** First line, e.g. "Kakinada Beach" */
  name: string;
  /** Second line, e.g. the locality and state */
  subtitle: string;
  lat?: number;
  lng?: number;
  favourite: boolean;
  usedAt: number;
}

/** Two entries are the same place when both lines match. */
function samePlace(a: Pick<HistoryPlace, 'name' | 'subtitle'>, b: Pick<HistoryPlace, 'name' | 'subtitle'>) {
  return a.name === b.name && a.subtitle === b.subtitle;
}

async function write(places: HistoryPlace[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

/** Favourites first, then the most recently used. */
export async function getPlaceHistory(): Promise<HistoryPlace[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const places = raw ? (JSON.parse(raw) as HistoryPlace[]) : [];
    return places.sort((a, b) => Number(b.favourite) - Number(a.favourite) || b.usedAt - a.usedAt);
  } catch {
    return [];
  }
}

/** Record a place the rider just searched for, keeping its favourite mark. */
export async function rememberPlace(place: Omit<HistoryPlace, 'favourite' | 'usedAt'>): Promise<void> {
  const places = await getPlaceHistory();
  const existing = places.find(p => samePlace(p, place));
  const updated: HistoryPlace = {
    ...place,
    favourite: existing?.favourite ?? false,
    usedAt: Date.now(),
  };
  const others = places.filter(p => !samePlace(p, place));
  const favourites = others.filter(p => p.favourite);
  const recents = others.filter(p => !p.favourite).slice(0, MAX_RECENT - (updated.favourite ? 0 : 1));
  await write([updated, ...favourites, ...recents]);
}

/** Mark or unmark a place as a favourite. Returns the new list. */
export async function toggleFavouritePlace(place: Pick<HistoryPlace, 'name' | 'subtitle'>): Promise<HistoryPlace[]> {
  const places = await getPlaceHistory();
  const next = places.map(p => (samePlace(p, place) ? { ...p, favourite: !p.favourite } : p));
  await write(next);
  return getPlaceHistory();
}
