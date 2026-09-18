jest.mock('../../api/axios', () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
}));

import { apiClient } from '../../api/axios';
import { mapsService } from '../mapsService';

describe('mapsService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('geocode posts address and returns result', async () => {
    const mock = { address: 'X', lat: 1, lng: 2 };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { data: mock } });
    const out = await mapsService.geocode('Some address');
    expect(out.address).toBe('X');
    expect(apiClient.post).toHaveBeenCalled();
  });

  test('getDistance builds query and returns distance', async () => {
    const mock = { distance: 1000, duration: 600 };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: mock } });
    const res = await mapsService.getDistance(0, 0, 1, 1);
    expect(res.distance).toBe(1000);
    expect(apiClient.get).toHaveBeenCalled();
  });

  test('getDirections returns directions data', async () => {
    const mock = { routes: [{}, {}] };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: mock } });
    const out = await mapsService.getDirections(0, 0, 1, 1);
    expect(out.routes.length).toBe(2);
  });
});
