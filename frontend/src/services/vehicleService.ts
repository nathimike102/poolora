import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sanchari_vehicles';

export interface Vehicle {
  id: string;
  name: string;
  color: string;
  regNumber: string;
  modelYear: string;
  seats: number;
  features: string[];
  imageUri: string | null;
  createdAt: number;
}

export async function getVehicles(): Promise<Vehicle[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Vehicle[];
}

export async function addVehicle(vehicle: Omit<Vehicle, 'id' | 'createdAt'>): Promise<Vehicle> {
  const vehicles = await getVehicles();
  const newVehicle: Vehicle = {
    ...vehicle,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
  };
  vehicles.push(newVehicle);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
  return newVehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  const vehicles = await getVehicles();
  const filtered = vehicles.filter(v => v.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
