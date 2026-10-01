jest.mock('../../api/axios', () => ({ apiClient: { get: jest.fn(), put: jest.fn(), delete: jest.fn() } }));

import { apiClient } from '../../api/axios';
import { trackerService } from '../trackerService';

const status = { gateway: null, vehicles: [] };

describe('trackerService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads, links and unlinks a car tracker', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: status } });
    (apiClient.put as jest.Mock).mockResolvedValue({ data: { data: status } });
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { data: status } });

    expect(await trackerService.status()).toEqual(status);
    expect(apiClient.get).toHaveBeenCalledWith('/users/me/trackers');
    await trackerService.link('v1', '359339075012345');
    expect(apiClient.put).toHaveBeenCalledWith('/users/me/vehicles/v1/tracker', { deviceId: '359339075012345' });
    await trackerService.unlink('v1');
    expect(apiClient.delete).toHaveBeenCalledWith('/users/me/vehicles/v1/tracker');
  });
});
