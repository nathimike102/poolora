import { SafetyService } from '../../services/SafetyService';
import { Booking } from '../../models/Booking';
import { User } from '../../models/User';
import { EmergencyRecord } from '../../models/EmergencyRecord';
import { EmergencyToken } from '../../models/EmergencyToken';
import { BookingStatus, SOSStatus } from '../../types';

jest.mock('../../models/Booking');
jest.mock('../../models/User');
jest.mock('../../models/EmergencyRecord');
jest.mock('../../models/EmergencyToken');
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../config', () => ({ config: { app: { baseUrl: 'http://localhost:5002' }, safety: { trackingTokenTtlSeconds: 3600, retentionDays: 7 }, twilio: {} } }));
jest.mock('axios');

const service = new SafetyService();

describe('SafetyService tokenization & retention', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an EmergencyToken and sets retentionExpiresAt on trigger', async () => {
    const mockBooking = { _id: 'booking123', rider: 'rider123', driver: 'driver456', ride: 'ride789', status: BookingStatus.CONFIRMED, populate: jest.fn().mockReturnThis() };
    const mockUser = { _id: 'rider123', name: 'Tester', emergencyContacts: [] };

    (Booking.findById as jest.Mock).mockReturnValue({ populate: jest.fn().mockResolvedValue(mockBooking) });
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
    (EmergencyRecord.findOne as jest.Mock).mockResolvedValue(null);

    // create returns an object with save()
    const createdRecord: any = {
      _id: 'emergencyABC',
      booking: 'booking123',
      triggeredBy: 'rider123',
      status: SOSStatus.TRIGGERED,
      liveTrackingUrl: '',
      timeline: [],
      save: jest.fn().mockResolvedValue(true),
    };

    (EmergencyRecord.create as jest.Mock).mockResolvedValue(createdRecord);
    const tokenCreate = jest.fn().mockResolvedValue({ token: 'token-123', expiresAt: new Date(Date.now() + 3600 * 1000) });
    (EmergencyToken.create as jest.Mock).mockImplementation(tokenCreate);

    const result = await service.triggerSOS('rider123', { bookingId: 'booking123', location: { lng: 77.1, lat: 28.7 } });

    // The token is stored before the record, and the record links to that same token
    const tokenArgs = (EmergencyToken.create as jest.Mock).mock.calls[0][0];
    const recordArgs = (EmergencyRecord.create as jest.Mock).mock.calls[0][0];
    expect(recordArgs._id).toBe(tokenArgs.emergencyId);
    expect(recordArgs.liveTrackingUrl).toBe(`http://localhost:5002/track/sos/${tokenArgs.token}`);
    expect(tokenArgs.expiresAt.getTime()).toBeGreaterThan(Date.now() + 3500 * 1000);
    expect(recordArgs.retentionExpiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
    expect(result).toBe(createdRecord);
    expect(createdRecord.save).toHaveBeenCalled();
  });
});
