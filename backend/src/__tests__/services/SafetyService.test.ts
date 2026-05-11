/**
 * Integration tests for SafetyService
 * Tests SOS lifecycle: trigger → update → acknowledge → resolve
 */

import { SafetyService } from '../../services/SafetyService';
import { Booking } from '../../models/Booking';
import { User } from '../../models/User';
import { EmergencyRecord } from '../../models/EmergencyRecord';
import { BookingStatus, SOSStatus } from '../../types';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../models/Booking');
jest.mock('../../models/User');
jest.mock('../../models/EmergencyRecord');
jest.mock('../../events', () => ({
  EventBridge: { publish: jest.fn() },
}));
jest.mock('../../config', () => ({
  config: {
    app: { baseUrl: 'http://localhost:5002' },
    twilio: {
      accountSid: '',
      authToken: '',
      phoneNumber: '',
    },
  },
}));
jest.mock('axios');

const safetyService = new SafetyService();

describe('SafetyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerSOS', () => {
    const mockBooking = {
      _id: 'booking123',
      rider: 'rider123',
      driver: 'driver456',
      ride: 'ride789',
      status: BookingStatus.CONFIRMED,
      populate: jest.fn().mockReturnThis(),
    };

    const mockUser = {
      _id: 'rider123',
      name: 'Test User',
      emergencyContacts: [
        { name: 'Mom', phone: '+911234567890', relation: 'mother' },
        { name: 'Dad', phone: '+919876543210', relation: 'father' },
      ],
    };

    it('should create an emergency record with correct fields', async () => {
      (Booking.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking),
      });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (EmergencyRecord.findOne as jest.Mock).mockResolvedValue(null);
      (EmergencyRecord.create as jest.Mock).mockResolvedValue({
        _id: 'emergency123',
        booking: 'booking123',
        triggeredBy: 'rider123',
        status: SOSStatus.TRIGGERED,
        triggerLocation: { type: 'Point', coordinates: [77.1, 28.7] },
        emergencyContactsNotified: mockUser.emergencyContacts,
        timeline: [],
      });

      const result = await safetyService.triggerSOS('rider123', {
        bookingId: 'booking123',
        location: { lng: 77.1, lat: 28.7 },
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(SOSStatus.TRIGGERED);
      expect(EmergencyRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking: 'booking123',
          triggeredBy: 'rider123',
          status: SOSStatus.TRIGGERED,
        }),
      );
    });

    it('should reject SOS from user not part of booking', async () => {
      (Booking.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking),
      });

      await expect(
        safetyService.triggerSOS('stranger999', {
          bookingId: 'booking123',
          location: { lng: 77.1, lat: 28.7 },
        }),
      ).rejects.toThrow('You are not part of this booking');
    });

    it('should reject SOS for non-confirmed booking', async () => {
      const cancelledBooking = { ...mockBooking, status: BookingStatus.CANCELLED };
      (Booking.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(cancelledBooking),
      });

      await expect(
        safetyService.triggerSOS('rider123', {
          bookingId: 'booking123',
          location: { lng: 77.1, lat: 28.7 },
        }),
      ).rejects.toThrow('SOS only available for active (confirmed) bookings');
    });

    it('should reject duplicate active SOS for same booking', async () => {
      (Booking.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking),
      });
      (EmergencyRecord.findOne as jest.Mock).mockResolvedValue({
        _id: 'existing-sos',
        status: SOSStatus.TRIGGERED,
      });

      await expect(
        safetyService.triggerSOS('rider123', {
          bookingId: 'booking123',
          location: { lng: 77.1, lat: 28.7 },
        }),
      ).rejects.toThrow('Active SOS already exists');
    });
  });

  describe('acknowledgeSOS', () => {
    it('should update status to ACKNOWLEDGED', async () => {
      const mockRecord = {
        _id: 'emergency123',
        status: SOSStatus.TRIGGERED,
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };
      (EmergencyRecord.findById as jest.Mock).mockResolvedValue(mockRecord);

      const result = await safetyService.acknowledgeSOS('emergency123', 'admin001');

      expect(result.status).toBe(SOSStatus.ACKNOWLEDGED);
      expect(mockRecord.save).toHaveBeenCalled();
    });

    it('should reject if SOS is already acknowledged', async () => {
      const mockRecord = {
        _id: 'emergency123',
        status: SOSStatus.ACKNOWLEDGED,
      };
      (EmergencyRecord.findById as jest.Mock).mockResolvedValue(mockRecord);

      await expect(
        safetyService.acknowledgeSOS('emergency123', 'admin001'),
      ).rejects.toThrow('SOS already acknowledged or resolved');
    });
  });

  describe('resolveSOS', () => {
    it('should resolve SOS with notes', async () => {
      const mockRecord = {
        _id: 'emergency123',
        status: SOSStatus.ACKNOWLEDGED,
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };
      (EmergencyRecord.findById as jest.Mock).mockResolvedValue(mockRecord);

      const result = await safetyService.resolveSOS(
        'emergency123',
        'admin001',
        'Situation resolved. User is safe.',
        false,
      );

      expect(result.status).toBe(SOSStatus.RESOLVED);
      expect(result.resolutionNotes).toBe('Situation resolved. User is safe.');
    });

    it('should mark as false alarm when isFalseAlarm=true', async () => {
      const mockRecord = {
        _id: 'emergency123',
        status: SOSStatus.TRIGGERED,
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };
      (EmergencyRecord.findById as jest.Mock).mockResolvedValue(mockRecord);

      const result = await safetyService.resolveSOS(
        'emergency123',
        'admin001',
        'Accidental trigger',
        true,
      );

      expect(result.status).toBe(SOSStatus.FALSE_ALARM);
    });
  });

  describe('getSOSStatus', () => {
    it('should return SOS record for authorized user', async () => {
      const mockRecord = {
        _id: 'emergency123',
        triggeredBy: 'rider123',
        booking: 'booking123',
        status: SOSStatus.TRIGGERED,
      };
      (EmergencyRecord.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockRecord),
        }),
      });
      (Booking.findById as jest.Mock).mockResolvedValue({
        rider: { toString: () => 'rider123' },
        driver: { toString: () => 'driver456' },
      });

      const result = await safetyService.getSOSStatus('emergency123', 'rider123');
      expect(result.status).toBe(SOSStatus.TRIGGERED);
    });

    it('should reject unauthorized user', async () => {
      const mockRecord = {
        _id: 'emergency123',
        triggeredBy: { toString: () => 'rider123' },
        booking: 'booking123',
        status: SOSStatus.TRIGGERED,
      };
      (EmergencyRecord.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockRecord),
        }),
      });
      (Booking.findById as jest.Mock).mockResolvedValue({
        rider: { toString: () => 'rider123' },
        driver: { toString: () => 'driver456' },
      });

      await expect(
        safetyService.getSOSStatus('emergency123', 'stranger999'),
      ).rejects.toThrow();
    });
  });

  describe('getEmergencyContacts', () => {
    it('should return user emergency contacts', async () => {
      const mockUser = {
        emergencyContacts: [
          { name: 'Mom', phone: '+911234567890', relation: 'mother' },
        ],
      };
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const contacts = await safetyService.getEmergencyContacts('user123');
      expect(contacts).toHaveLength(1);
      expect(contacts[0].name).toBe('Mom');
    });

    it('should throw if user not found', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(safetyService.getEmergencyContacts('nonexistent')).rejects.toThrow();
    });
  });

  describe('updateSOSLocation', () => {
    it('should atomically push location to history', async () => {
      (EmergencyRecord.findOneAndUpdate as jest.Mock).mockResolvedValue({
        _id: 'emergency123',
      });

      await safetyService.updateSOSLocation('emergency123', { lng: 77.2, lat: 28.8 });

      expect(EmergencyRecord.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'emergency123',
          status: { $nin: [SOSStatus.RESOLVED, SOSStatus.FALSE_ALARM] },
        },
        expect.objectContaining({
          $push: expect.objectContaining({
            locationHistory: expect.any(Object),
          }),
        }),
      );
    });
  });
});
