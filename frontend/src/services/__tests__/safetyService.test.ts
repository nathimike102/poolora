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

  test('triggerSOS without a position still sends, and leaves the position to the server', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { data: { emergency: { _id: 's2' } } } });
    await safetyService.triggerSOS('b1', null);
    expect(apiClient.post).toHaveBeenCalledWith('/safety/sos', { bookingId: 'b1' });
  });

  test('getCurrentSOS and cancelSOS use their endpoints', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: { sos: null, bookingId: 'b9' } } });
    expect(await safetyService.getCurrentSOS()).toEqual({ sos: null, bookingId: 'b9' });
    expect(apiClient.get).toHaveBeenCalledWith('/safety/sos/current');

    (apiClient.post as jest.Mock).mockResolvedValue({ data: { data: { emergency: { _id: 's3', status: 'false_alarm' } } } });
    expect((await safetyService.cancelSOS('s3')).status).toBe('false_alarm');
    expect(apiClient.post).toHaveBeenCalledWith('/safety/sos/s3/cancel', {});
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
