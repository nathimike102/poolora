/**
 * Countries at sign-in: numbers from anywhere are accepted, the market's own
 * numbers are checked strictly, and rides are open only in the market.
 */
import { countryByCode, flagOf, HOME_COUNTRY, isServedCountry, toE164For } from '../countries';
import { ridesAvailable } from '../../services/locationCountry';

jest.mock('../../services/simulationService', () => ({ simulationService: { isEnabled: jest.fn() } }));

const zw = countryByCode('zw')!;
const india = countryByCode('IN')!;

test('looks countries up by code, in either case', () => {
  expect(zw).toEqual({ code: 'ZW', name: 'Zimbabwe', dial: '+263' });
  expect(countryByCode('xx')).toBeUndefined();
  expect(HOME_COUNTRY.code).toBe('ZW');
  expect(flagOf('ZW')).toBe('🇿🇼');
});

test('Zimbabwe numbers must be real mobile numbers', () => {
  expect(toE164For(zw, '0771 234 567')).toBe('+263771234567');
  expect(toE164For(zw, '771234567')).toBe('+263771234567');
  expect(toE164For(zw, '263771234567')).toBe('+263771234567');
  expect(toE164For(zw, '641234567')).toBeNull();
});

test('other countries only need a believable length', () => {
  expect(toE164For(india, '98765 43210')).toBe('+919876543210');
  expect(toE164For(india, '919876543210')).toBe('+919876543210');
  expect(toE164For(india, '12345')).toBeNull();
  expect(toE164For(india, '1234567890123456')).toBeNull();
});

test('rides are open in the market, where the country is unknown, and on a test server', () => {
  expect(isServedCountry('ZW')).toBe(true);
  expect(isServedCountry('IN')).toBe(false);
  expect(ridesAvailable({ code: 'ZW', source: 'location' })).toBe(true);
  expect(ridesAvailable({ source: 'none' })).toBe(true);
  // Outside the market: still checking, then closed, unless the server is a test server
  expect(ridesAvailable({ code: 'IN', source: 'location' })).toBeUndefined();
  expect(ridesAvailable({ code: 'IN', source: 'location', testServer: false })).toBe(false);
  expect(ridesAvailable({ code: 'IN', source: 'location', testServer: true })).toBe(true);
});

test('emergency numbers follow the country, with 112 where none are known for sure', () => {
  const { emergencyNumbersFor } = jest.requireActual('../emergencyNumbers') as typeof import('../emergencyNumbers');
  expect(emergencyNumbersFor('ZW')).toEqual({ general: '999', police: '995', ambulance: '994', fire: '993' });
  expect(emergencyNumbersFor('in')).toMatchObject({ general: '112', police: '100', ambulance: '108' });
  expect(emergencyNumbersFor('DE')).toEqual({ general: '112', police: '112', ambulance: '112', fire: '112' });
  // Not listed: 112 alone, no guessed police or ambulance numbers
  expect(emergencyNumbersFor('TZ')).toEqual({ general: '112' });
  // Unknown country: the market's own
  expect(emergencyNumbersFor(undefined).general).toBe('999');
});
