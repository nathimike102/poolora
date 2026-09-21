import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IconName } from '../components/Icon';

const STORAGE_KEY = '@poolora_saved_routes';

/** Routes saved on this device for quick searching. */
export interface SavedRoute {
  id: string;
  name: string;
  from: string;
  to: string;
  icon: IconName;
  createdAt: number;
}

const LEGACY_ICONS: Record<string, IconName> = {
  '🏠': 'home', '🏢': 'office-building', '✈️': 'airplane', '🏥': 'hospital-building',
  '🎓': 'school', '🛒': 'cart', '🏋️': 'dumbbell', '📍': 'map-marker',
};

export async function getSavedRoutes(): Promise<SavedRoute[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    // Older builds stored an emoji and free-text time/savings; keep only what the user chose.
    return (JSON.parse(raw) as Array<SavedRoute & { icon: string }>).map(r => ({
      id: r.id,
      name: r.name,
      from: r.from,
      to: r.to,
      icon: LEGACY_ICONS[r.icon] ?? (r.icon as IconName) ?? 'map-marker',
      createdAt: r.createdAt,
    }));
  } catch {
    return [];
  }
}

export async function addSavedRoute(route: Omit<SavedRoute, 'id' | 'createdAt'>): Promise<SavedRoute> {
  const routes = await getSavedRoutes();
  const newRoute: SavedRoute = {
    ...route,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
  };
  routes.push(newRoute);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  return newRoute;
}

export async function deleteSavedRoute(id: string): Promise<void> {
  const routes = await getSavedRoutes();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes.filter(r => r.id !== id)));
}
