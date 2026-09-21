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

  test('getActiveIncidents maps backend emergency records', async () => {
    // Shape returned by GET /safety/sos/active
    const recs = [{
      _id: 'e1',
      status: 'triggered',
      triggeredBy: { _id: 'u1', name: 'Fatima Khan', phone: '+919876500050' },
      booking: { _id: 'b1' },
      triggerLocation: { type: 'Point', coordinates: [72.8474, 19.1871] },
      createdAt: '2026-09-21T09:21:35.986Z',
    }];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: { records: recs, total: 1 } } });
    const [incident] = await safetyService.getActiveIncidents();
    expect(incident).toEqual({
      id: 'e1',
      userId: 'u1',
      userName: 'Fatima Khan',
      status: 'triggered',
      location: { lat: 19.1871, lng: 72.8474 },
      timestamp: new Date('2026-09-21T09:21:35.986Z'),
      bookingId: 'b1',
    });
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
