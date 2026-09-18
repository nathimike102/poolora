/**
 * Unit tests for ParcelPoolingService — focusing on:
 * - Only the assigned driver can pick up and deliver
 * - Delivery requires the recipient's code, with limited attempts
 * - Tracking details are only visible to the people involved
 */
import crypto from 'crypto';

jest.mock('razorpay', () => jest.fn());
jest.mock('../../models/ParcelPooling', () => ({
  ParcelPooling: { findById: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() },
}));
jest.mock('../../models/Ride', () => ({ Ride: { findById: jest.fn() } }));
jest.mock('../../models/User', () => ({ User: { findById: jest.fn() } }));
jest.mock('../../models/Notification', () => ({ Notification: {} }));
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { ParcelPoolingService } from '../../services/ParcelPoolingService';
import { ParcelPooling } from '../../models/ParcelPooling';
import { BookingStatus, UserCapability } from '../../types';

const service = new ParcelPoolingService();
const DRIVER = 'driver-1';
const SENDER = 'sender-1';
const OTP = '482913';

function parcel(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'parcel-1',
    sender: SENDER,
    driver: DRIVER,
    receiver: undefined,
    status: BookingStatus.CONFIRMED,
    actualPickupTime: new Date(),
    estimatedCost: 100,
    trackingNumber: 'TRK-ABC-0123ABCD',
    deliveryOtpHash: crypto.createHash('sha256').update(OTP).digest('hex'),
    deliveryOtpAttempts: 0,
    save: jest.fn().mockResolvedValue(true),
    populate: jest.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

function mockFindForDelivery(doc: unknown) {
  (ParcelPooling.findById as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(doc) });
}

describe('ParcelPoolingService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('pickupParcel', () => {
    it('rejects a driver who is not assigned to the parcel', async () => {
      const doc = parcel();
      (ParcelPooling.findById as jest.Mock).mockResolvedValue(doc);

      await expect(service.pickupParcel('parcel-1', 'other-driver')).rejects.toThrow('Only the assigned driver');
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('records pickup for the assigned driver', async () => {
      const doc = parcel({ actualPickupTime: undefined });
      (ParcelPooling.findById as jest.Mock).mockResolvedValue(doc);

      await service.pickupParcel('parcel-1', DRIVER);
      expect(doc.actualPickupTime).toBeInstanceOf(Date);
    });
  });

  describe('completeDelivery', () => {
    it('rejects a driver who is not assigned to the parcel', async () => {
      mockFindForDelivery(parcel());
      await expect(
        service.completeDelivery('parcel-1', 'other-driver', { signature: 'sig', otp: OTP }),
      ).rejects.toThrow('Only the assigned driver');
    });

    it('requires the parcel to have been picked up', async () => {
      mockFindForDelivery(parcel({ actualPickupTime: undefined }));
      await expect(
        service.completeDelivery('parcel-1', DRIVER, { signature: 'sig', otp: OTP }),
      ).rejects.toThrow('picked up before delivery');
    });

    it('rejects a wrong delivery code and counts the attempt', async () => {
      const doc = parcel();
      mockFindForDelivery(doc);

      await expect(
        service.completeDelivery('parcel-1', DRIVER, { signature: 'sig', otp: '000000' }),
      ).rejects.toThrow('Incorrect delivery code');
      expect(ParcelPooling.updateOne).toHaveBeenCalledWith({ _id: 'parcel-1' }, { $inc: { deliveryOtpAttempts: 1 } });
      expect(doc.status).toBe(BookingStatus.CONFIRMED);
    });

    it('locks delivery after too many wrong codes', async () => {
      mockFindForDelivery(parcel({ deliveryOtpAttempts: 5 }));
      await expect(
        service.completeDelivery('parcel-1', DRIVER, { signature: 'sig', otp: OTP }),
      ).rejects.toThrow('Too many incorrect delivery codes');
    });

    it('completes delivery with the correct code and clears it', async () => {
      const doc = parcel();
      mockFindForDelivery(doc);

      await service.completeDelivery('parcel-1', DRIVER, { signature: 'sig', otp: OTP });

      expect(doc.status).toBe(BookingStatus.COMPLETED);
      expect(doc.deliveryOtpHash).toBeUndefined();
      expect(doc.save).toHaveBeenCalled();
    });
  });

  describe('getParcelByTracking', () => {
    it('hides the parcel from users who are not involved', async () => {
      (ParcelPooling.findOne as jest.Mock).mockResolvedValue(parcel());
      await expect(
        service.getParcelByTracking('TRK-ABC-0123ABCD', { userId: 'someone', capabilities: [UserCapability.RIDER] }),
      ).rejects.toThrow('Parcel');
    });

    it('returns the parcel to the sender and to admins', async () => {
      (ParcelPooling.findOne as jest.Mock).mockResolvedValue(parcel());
      await expect(
        service.getParcelByTracking('TRK-ABC-0123ABCD', { userId: SENDER, capabilities: [UserCapability.RIDER] }),
      ).resolves.toBeDefined();

      (ParcelPooling.findOne as jest.Mock).mockResolvedValue(parcel());
      await expect(
        service.getParcelByTracking('TRK-ABC-0123ABCD', { userId: 'admin', capabilities: [UserCapability.ADMIN] }),
      ).resolves.toBeDefined();
    });
  });
});
