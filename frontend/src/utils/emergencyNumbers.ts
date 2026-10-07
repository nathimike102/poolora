/**
 * utils/emergencyNumbers.ts
 *
 * The emergency numbers for the country the phone is in, so the SOS screen
 * and every "call the police" hint dial something that works where the person
 * actually is, even outside Poolora's markets.
 *
 * Only numbers that are well established are listed. Anywhere else the app
 * offers 112 alone: mobile networks in most of the world connect 112 to the
 * local emergency service, and a wrong police or ambulance number would be
 * worse than none. Check this table before launching in a new country.
 */

import { getLocationCountry, useLocationCountry } from '../services/locationCountry';
import { MARKETS, REGION } from './region';

export interface EmergencyNumbers {
  /** The number to call first */
  general: string;
  police?: string;
  ambulance?: string;
  fire?: string;
}

const same = (n: string): EmergencyNumbers => ({ general: n, police: n, ambulance: n, fire: n });

const NUMBERS: Record<string, EmergencyNumbers> = {
  // Southern and East Africa
  ZA: { general: '112', police: '10111', ambulance: '10177', fire: '10177' },
  BW: { general: '999', police: '999', ambulance: '997', fire: '998' },
  MW: { general: '997', police: '997', ambulance: '998', fire: '999' },
  KE: same('999'),
  GH: { general: '112', police: '191', ambulance: '193', fire: '192' },
  EG: { general: '122', police: '122', ambulance: '123', fire: '180' },
  // Asia
  IN: { general: '112', police: '100', ambulance: '108', fire: '101' },
  PK: { general: '15', police: '15', ambulance: '1122', fire: '16' },
  BD: same('999'),
  CN: { general: '110', police: '110', ambulance: '120', fire: '119' },
  JP: { general: '110', police: '110', ambulance: '119', fire: '119' },
  KR: { general: '112', police: '112', ambulance: '119', fire: '119' },
  SG: { general: '999', police: '999', ambulance: '995', fire: '995' },
  MY: same('999'),
  TH: { general: '191', police: '191', ambulance: '1669', fire: '199' },
  PH: same('911'),
  AE: { general: '999', police: '999', ambulance: '998', fire: '997' },
  // Europe: 112 everywhere in the EU
  GB: same('999'),
  IE: same('112'),
  RU: { general: '112', police: '102', ambulance: '103', fire: '101' },
  // Americas and Oceania
  US: same('911'),
  CA: same('911'),
  MX: same('911'),
  BR: { general: '190', police: '190', ambulance: '192', fire: '193' },
  AU: same('000'),
  NZ: same('111'),
};

const EU_112 = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

/** The numbers for a country code; the market's own when the country is unknown */
export function emergencyNumbersFor(code?: string): EmergencyNumbers {
  if (!code) return REGION.emergency;
  const upper = code.toUpperCase();
  const market = MARKETS[upper];
  if (market) return market.emergency;
  if (NUMBERS[upper]) return NUMBERS[upper];
  if (EU_112.includes(upper)) return same('112');
  return { general: '112' };
}

/** The numbers where the phone is now, for alerts and other code outside components */
export const emergencyNumbers = (): EmergencyNumbers => emergencyNumbersFor(getLocationCountry().code);

/** The numbers where the phone is, updating when the country is found */
export function useEmergencyNumbers(): EmergencyNumbers {
  return emergencyNumbersFor(useLocationCountry().code);
}
