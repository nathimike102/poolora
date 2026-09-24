/**
 * The free OpenStreetMap provider must answer in the same shapes as Google so
 * the rest of the app does not care which one is configured.
 */
import axios from 'axios';
import { autocomplete, geocodeAddress, reverseGeocode, getRoute } from '../../services/MapsService';

jest.mock('axios');
jest.mock('../../config/redis', () => ({ getRedisClient: () => null }));
jest.mock('../../config', () => ({
  config: {
    maps: {
      googleMapsKey: '',
      provider: 'osm',
      photonUrl: 'https://photon.test',
      nominatimUrl: 'https://nominatim.test',
      osrmUrl: 'https://osrm.test',
      osmUserAgent: 'Poolora tests',
    },
  },
}));

const mockedGet = axios.get as jest.Mock;
(axios.isAxiosError as unknown as jest.Mock) = jest.fn(() => false);

describe('OpenStreetMap maps provider', () => {
  it('turns Photon results into suggestions, skipping other countries and repeats', async () => {
    const koramangala = {
      geometry: { coordinates: [77.62, 12.93] },
      properties: { osm_type: 'N', osm_id: 1, name: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', countrycode: 'IN' },
    };
    mockedGet.mockResolvedValue({
      data: {
        features: [
          koramangala,
          { ...koramangala, properties: { ...koramangala.properties, osm_type: 'W', osm_id: 2 } },
          { geometry: { coordinates: [0, 0] }, properties: { name: 'Koramangala Cafe', countrycode: 'LK' } },
        ],
      },
    });

    const results = await autocomplete('Koramangala');

    expect(results).toEqual([
      {
        description: 'Koramangala, Bengaluru, Karnataka',
        placeId: 'osm:N1',
        mainText: 'Koramangala',
        secondaryText: 'Bengaluru, Karnataka',
      },
    ]);
    expect(mockedGet.mock.calls[0][0]).toBe('https://photon.test/api/');
    expect(mockedGet.mock.calls[0][1].headers['User-Agent']).toBe('Poolora tests');
  });

  it('ranks places near the user first, with the position rounded for caching', async () => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ data: { features: [] } });
    await autocomplete('Indiranagar', { lat: 12.97194, lng: 77.64117 });
    expect(mockedGet.mock.calls[0][1].params).toMatchObject({ q: 'indiranagar', lat: '12.97', lon: '77.64' });
  });

  it('geocodes with Nominatim and reports an unknown address plainly', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [{ lat: '12.97', lon: '77.59', display_name: 'MG Road, Bengaluru', osm_type: 'way', osm_id: 42 }],
    });
    await expect(geocodeAddress('MG Road')).resolves.toEqual({
      formattedAddress: 'MG Road, Bengaluru',
      lat: 12.97,
      lng: 77.59,
      placeId: 'osm:W42',
    });

    mockedGet.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: { features: [] } });
    await expect(geocodeAddress('nowhere at all')).rejects.toThrow('We could not find that address.');
  });

  it('falls back to Photon for place labels Nominatim cannot match word for word', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
      data: {
        features: [
          { geometry: { coordinates: [77.69, 12.99] }, properties: { osm_type: 'N', osm_id: 9, countrycode: 'IN' } },
        ],
      },
    });

    await expect(geocodeAddress('Phoenix Marketcity, Whitefield, Bengaluru')).resolves.toEqual({
      formattedAddress: 'Phoenix Marketcity, Whitefield, Bengaluru',
      lat: 12.99,
      lng: 77.69,
      placeId: 'osm:N9',
    });
  });

  it('maps Nominatim address parts onto Google component types', async () => {
    mockedGet.mockResolvedValue({
      data: {
        display_name: '80 Feet Road, Koramangala, Bengaluru, Karnataka, 560095, India',
        osm_type: 'node',
        osm_id: 7,
        lat: '12.93',
        lon: '77.62',
        address: { road: '80 Feet Road', suburb: 'Koramangala', city: 'Bengaluru', postcode: '560095', country: 'India', country_code: 'in' },
      },
    });

    const result = await reverseGeocode(12.93, 77.62);

    expect(result.placeId).toBe('osm:N7');
    expect(result.addressComponents).toContainEqual({ long_name: 'Bengaluru', short_name: 'Bengaluru', types: ['locality', 'political'] });
    expect(result.addressComponents).toContainEqual({ long_name: 'India', short_name: 'IN', types: ['country', 'political'] });
  });

  it('routes with OSRM and keeps its polyline', async () => {
    mockedGet.mockResolvedValue({
      data: {
        code: 'Ok',
        routes: [{ distance: 17236.3, duration: 1107.2, geometry: 'abc' }],
        waypoints: [{ name: 'Hosur Road' }, { name: 'Whitefield Main Road' }],
      },
    });

    const route = await getRoute({ lat: 12.93, lng: 77.62 }, { lat: 12.97, lng: 77.75 });

    expect(route).toEqual({
      distanceKm: 17.24,
      durationMins: 18,
      polyline: 'abc',
      startAddress: 'Hosur Road',
      endAddress: 'Whitefield Main Road',
    });
    expect(mockedGet.mock.calls[0][0]).toBe('https://osrm.test/route/v1/driving/77.62,12.93;77.75,12.97');
  });

  it('says so when there is no road between two points', async () => {
    mockedGet.mockResolvedValue({ data: { code: 'NoRoute', routes: [] } });
    await expect(getRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 })).rejects.toThrow(
      'We could not find a route between those places.',
    );
  });

  it('hides provider outages behind a plain message', async () => {
    mockedGet.mockRejectedValue(new Error('socket hang up'));
    await expect(autocomplete('Indiranagar')).rejects.toThrow(
      'Maps are unavailable right now. Please try again in a moment.',
    );
  });
});
