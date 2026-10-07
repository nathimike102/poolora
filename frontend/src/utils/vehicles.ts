/**
 * utils/vehicles.ts
 *
 * Groups the backend's vehicle types into the kinds riders choose between,
 * with the label and icon for each, and the types a driver can register.
 */

import type { IconName } from '../components/Icon';
import type { Icon3DName } from '../components/Icon3D';
import type { VehicleType } from '../types/api';
import i18n from '../i18n';

export type VehicleCategory = 'car' | 'suv' | 'minivan' | 'auto' | 'bike';

/** Labels and blurbs come from the catalogue (vehicles.*), read when shown so they follow the language */
const category = (key: VehicleCategory, icon: IconName, icon3d: Icon3DName) => ({
  icon,
  /** The 3D picture for tiles and ride options */
  icon3d,
  get label() { return i18n.t(`vehicles.${key}.label`); },
  get blurb() { return i18n.t(`vehicles.${key}.blurb`); },
});

export const VEHICLE_CATEGORIES: Record<VehicleCategory, { label: string; icon: IconName; icon3d: Icon3DName; blurb: string }> = {
  car: category('car', 'car-side', 'automobile'),
  suv: category('suv', 'car-pickup', 'sportUtilityVehicle'),
  minivan: category('minivan', 'van-passenger', 'minibus'),
  auto: category('auto', 'rickshaw', 'autoRickshaw'),
  bike: category('bike', 'motorbike', 'motorcycle'),
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
const registrable = (value: VehicleType, maxSeats: number) => ({
  value,
  maxSeats,
  get label() { return i18n.t(`vehicles.types.${value}`); },
});

export const REGISTRABLE_VEHICLES: { value: VehicleType; label: string; maxSeats: number }[] = [
  registrable('hatchback', 4),
  registrable('sedan', 4),
  registrable('suv', 6),
  registrable('pickup', 4),
  registrable('minivan', 7),
  registrable('auto', 3),
  registrable('bike', 1),
];

/** Seats a ride in this vehicle may offer; 6 when the vehicle is unknown */
export function maxSeatsFor(type?: VehicleType): number {
  return REGISTRABLE_VEHICLES.find(v => v.value === type)?.maxSeats ?? 6;
}
