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
      osmUserAgent: 'Siham tests',
    },
  },
}));

const mockedGet = axios.get as jest.Mock;
(axios.isAxiosError as unknown as jest.Mock) = jest.fn(() => false);

describe('OpenStreetMap maps provider', () => {
  it('turns Photon results into suggestions, skipping other countries and repeats', async () => {
    const borrowdale = {
      geometry: { coordinates: [31.09, -17.76] },
      properties: { osm_type: 'N', osm_id: 1, name: 'Borrowdale', city: 'Harare', state: 'Harare Province', countrycode: 'ZW' },
    };
    mockedGet.mockResolvedValue({
      data: {
        features: [
          borrowdale,
          { ...borrowdale, properties: { ...borrowdale.properties, osm_type: 'W', osm_id: 2 } },
          { geometry: { coordinates: [0, 0] }, properties: { name: 'Borrowdale Cafe', countrycode: 'ZA' } },
        ],
      },
    });

    const results = await autocomplete('Borrowdale');

    expect(results).toEqual([
      {
        description: 'Borrowdale, Harare, Harare Province',
        placeId: 'osm:N1',
        mainText: 'Borrowdale',
        secondaryText: 'Harare, Harare Province',
      },
    ]);
    expect(mockedGet.mock.calls[0][0]).toBe('https://photon.test/api/');
    expect(mockedGet.mock.calls[0][1].headers['User-Agent']).toBe('Siham tests');
  });

  it('ranks places near the user first, with the position rounded for caching', async () => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ data: { features: [] } });
    await autocomplete('Avondale', { lat: -17.80194, lng: 31.04117 });
    expect(mockedGet.mock.calls[0][1].params).toMatchObject({ q: 'avondale', lat: '-17.8', lon: '31.04' });
  });

  it('geocodes with Nominatim and reports an unknown address plainly', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [{ lat: '-17.83', lon: '31.05', display_name: 'Samora Machel Avenue, Harare', osm_type: 'way', osm_id: 42 }],
    });
    await expect(geocodeAddress('Samora Machel Avenue')).resolves.toEqual({
      formattedAddress: 'Samora Machel Avenue, Harare',
      lat: -17.83,
      lng: 31.05,
      placeId: 'osm:W42',
    });

    mockedGet.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: { features: [] } });
    await expect(geocodeAddress('nowhere at all')).rejects.toThrow('We could not find that address.');
  });

  it('falls back to Photon for place labels Nominatim cannot match word for word', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
      data: {
        features: [
          { geometry: { coordinates: [31.09, -17.76] }, properties: { osm_type: 'N', osm_id: 9, countrycode: 'ZW' } },
        ],
      },
    });

    await expect(geocodeAddress("Sam Levy's Village, Borrowdale, Harare")).resolves.toEqual({
      formattedAddress: "Sam Levy's Village, Borrowdale, Harare",
      lat: -17.76,
      lng: 31.09,
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
