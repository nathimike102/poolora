jest.mock('../../api/axios', () => ({
  apiClient: { get: jest.fn().mockResolvedValue({ data: { data: { formattedAddress: 'Harare', lat: -17.83, lng: 31.05, placeId: 'g1' } } }) },
}));

import { apiClient } from '../../api/axios';
import { choosePlace, geocodePlace } from '../placesService';

describe('choosing a place', () => {
  test('a rank or terminus keeps the exact position its admin placed, not a search for its name', async () => {
    const label = choosePlace({ placeId: 'hub:1', name: 'Mbare Musika', subtitle: 'Bus terminus · Harare', hub: 'bus_terminus', lat: -17.8615, lng: 31.0367 });
    expect(label).toBe('Mbare Musika, Bus terminus · Harare');
    expect(await geocodePlace(label)).toMatchObject({ lat: -17.8615, lng: 31.0367 });
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  test('an ordinary place is still found by its text', async () => {
    const label = choosePlace({ placeId: 'g1', name: 'Avondale', subtitle: 'Harare' });
    expect(await geocodePlace(label)).toMatchObject({ lat: -17.83 });
    expect(apiClient.get).toHaveBeenCalled();
  });
});
