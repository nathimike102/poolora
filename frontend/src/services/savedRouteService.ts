import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@ridepool_saved_routes';

export interface SavedRoute {
  id: string;
  name: string;
  from: string;
  to: string;
  icon: string;
  time: string;
  savings: string;
  createdAt: number;
}

export async function getSavedRoutes(): Promise<SavedRoute[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SavedRoute[];
}

export async function addSavedRoute(
  route: Omit<SavedRoute, 'id' | 'createdAt'>,
): Promise<SavedRoute> {
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
  const filtered = routes.filter(r => r.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
