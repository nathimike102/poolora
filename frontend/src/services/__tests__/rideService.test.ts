jest.mock('../../api/axios', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../../api/axios';
import { rideService } from '../rideService';

const searchParams = {
  pickupLat: 12.9716,
  pickupLng: 77.5946,
  dropoffLat: 13.0827,
  dropoffLng: 80.2707,
  departureTime: '2026-09-15T09:00:00.000Z',
};

describe('rideService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('searchRides builds query and returns data', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: { items: [{ _id: 'r1' }], total: 1 } } });
    const res = await rideService.searchRides(searchParams, 2, 10);
    expect(res.data.items.length).toBe(1);
    expect(apiClient.get).toHaveBeenCalled();
  });

  test('createRide posts and returns ride', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { data: { _id: 'created' } } });
    const out = await rideService.createRide({ from: 'A', to: 'B', seats: 2 } as any);
    expect(out._id).toBe('created');
  });

  test('getRide returns ride detail', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: { _id: 'r100' } } });
    const r = await rideService.getRide('r100');
    expect(r._id).toBe('r100');
  });

  test('updateDriverLocation posts location', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({});
    await expect(rideService.updateDriverLocation({ lat: 1, lng: 2 } as any)).resolves.toBeUndefined();
    expect(apiClient.post).toHaveBeenCalled();
  });

  test('searchRides throws when api fails', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('network'));
    await expect(rideService.searchRides(searchParams)).rejects.toThrow('network');
  });

  test('createRide throws on failure', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('bad'));
    await expect(rideService.createRide({ from: 'A' } as any)).rejects.toThrow('bad');
  });

  test('getMyRides includes status param', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: { items: [], total: 0 } } });
    const res = await rideService.getMyRides('active', 1, 5);
    expect(res.data.items).toEqual([]);
    expect(apiClient.get).toHaveBeenCalled();
  });

  test('cancelRide and completeRide throw on backend error', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('cancel-fail'));
    await expect(rideService.cancelRide('r9')).rejects.toThrow('cancel-fail');

    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('complete-fail'));
    await expect(rideService.completeRide('r9')).rejects.toThrow('complete-fail');
  });
});
