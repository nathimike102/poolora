jest.mock('../../api/axios', () => ({
  apiClient: { post: jest.fn(), get: jest.fn(), put: jest.fn() },
}));

import { apiClient } from '../../api/axios';
import { safetyService } from '../safetyService';

describe('safetyService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('triggerSOS returns emergency object', async () => {
    const mock = { _id: 's1', status: 'triggered', location: { lat: 1, lng: 2 }, createdAt: new Date().toISOString() };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { data: { emergency: mock } } });
    const res = await safetyService.triggerSOS('b1', { lat: 1, lng: 2 });
    expect(res._id).toBe('s1');
  });

  test('getActiveIncidents returns records array', async () => {
    const recs = [{ id: 'i1', userId: 'u1', userName: 'U', status: 'triggered', location: { lat: 0, lng: 0 }, timestamp: new Date(), bookingId: 'b1' }];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: { records: recs, total: 1 } } });
    const out = await safetyService.getActiveIncidents();
    expect(out.length).toBe(1);
  });

  test('acknowledgeIncident posts and resolves', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({});
    await expect(safetyService.acknowledgeIncident('i1')).resolves.toBeUndefined();
    expect(apiClient.post).toHaveBeenCalled();
  });

  test('getEmergencyContacts and updateEmergencyContacts', async () => {
    const contacts = [{ name: 'A', phone: '+1', relation: 'friend' }];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: { contacts } } });
    const out = await safetyService.getEmergencyContacts();
    expect(out[0].name).toBe('A');

    (apiClient.put as jest.Mock).mockResolvedValue({ data: { data: { contacts } } });
    const upd = await safetyService.updateEmergencyContacts(contacts as any);
    expect(upd[0].phone).toBe('+1');
  });
});
