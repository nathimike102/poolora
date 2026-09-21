/**
 * utils/vehicles.ts
 *
 * Groups the backend's vehicle types into the three kinds riders choose
 * between, with the label and icon for each.
 */

import type { IconName } from '../components/Icon';
import type { VehicleType } from '../types/api';

export type VehicleCategory = 'bike' | 'auto' | 'cab';

export const VEHICLE_CATEGORIES: Record<VehicleCategory, { label: string; icon: IconName; blurb: string }> = {
  bike: { label: 'Bike', icon: 'motorbike', blurb: 'Ride pillion with a driver going your way' },
  auto: { label: 'Auto', icon: 'rickshaw', blurb: 'Share an auto going your way' },
  cab: { label: 'Cab', icon: 'car-side', blurb: 'Share a car going your way' },
};

/** Rides with no vehicle on record are shown as cabs, the most common case. */
export function vehicleCategory(type?: VehicleType): VehicleCategory {
  if (type === 'bike') return 'bike';
  if (type === 'auto') return 'auto';
  return 'cab';
}
