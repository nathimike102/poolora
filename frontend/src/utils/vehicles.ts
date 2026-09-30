/**
 * utils/vehicles.ts
 *
 * Groups the backend's vehicle types into the kinds riders choose between,
 * with the label and icon for each, and the types a driver can register.
 */

import type { IconName } from '../components/Icon';
import type { VehicleType } from '../types/api';

export type VehicleCategory = 'car' | 'suv' | 'minivan' | 'auto' | 'bike';

export const VEHICLE_CATEGORIES: Record<VehicleCategory, { label: string; icon: IconName; blurb: string }> = {
  car: { label: 'Car', icon: 'car-side', blurb: 'Share a car going your way' },
  suv: { label: 'SUV', icon: 'car-pickup', blurb: 'SUVs and bakkies, with room for luggage' },
  minivan: { label: 'Minivan', icon: 'van-passenger', blurb: 'Seven-seaters for groups and long trips' },
  auto: { label: 'Auto', icon: 'rickshaw', blurb: 'Share a tuk-tuk going your way' },
  bike: { label: 'Bike', icon: 'motorbike', blurb: 'Ride pillion with a driver going your way' },
};

/** Rides with no vehicle on record are shown as cars, the most common case. */
export function vehicleCategory(type?: VehicleType): VehicleCategory {
  if (type === 'bike') return 'bike';
  if (type === 'auto') return 'auto';
  if (type === 'minivan') return 'minivan';
  if (type === 'suv' || type === 'pickup') return 'suv';
  return 'car';
}

/** What a driver can register, with the most seats each may offer (mirrors the backend) */
export const REGISTRABLE_VEHICLES: { value: VehicleType; label: string; maxSeats: number }[] = [
  { value: 'hatchback', label: 'Hatchback', maxSeats: 4 },
  { value: 'sedan', label: 'Sedan', maxSeats: 4 },
  { value: 'suv', label: 'SUV', maxSeats: 6 },
  { value: 'pickup', label: 'Bakkie', maxSeats: 4 },
  { value: 'minivan', label: 'Minivan', maxSeats: 7 },
  { value: 'auto', label: 'Auto (tuk-tuk)', maxSeats: 3 },
  { value: 'bike', label: 'Motorbike', maxSeats: 1 },
];

/** Seats a ride in this vehicle may offer; 6 when the vehicle is unknown */
export function maxSeatsFor(type?: VehicleType): number {
  return REGISTRABLE_VEHICLES.find(v => v.value === type)?.maxSeats ?? 6;
}
