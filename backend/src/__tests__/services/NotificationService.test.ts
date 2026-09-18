/**
 * Tests for NotificationService
 * Covers FCM push notifications, Twilio SMS, and in-app notifications.
 */

import { NotificationService } from '../../services/NotificationService';
import { User } from '../../models/User';
import { Notification } from '../../models/Notification';
import { getMessaging } from 'firebase-admin/messaging';

jest.mock('../../models/User');
jest.mock('../../models/Notification');
jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/messaging', () => {
  const mockSend = jest.fn().mockResolvedValue('message-id-123');
  return { getMessaging: jest.fn(() => ({ send: mockSend })) };
});
jest.mock('twilio', () => {
  const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM123' });
  return jest.fn(() => ({
    messages: { create: mockCreate },
  }));
});
jest.mock('../../config', () => ({
  config: {
    firebase: {
      serviceAccountJson: '',
      serviceAccountPath: '',
      projectId: '',
    },
    twilio: {
      enabled: true,
      accountSid: 'AC_TEST_SID',
      authToken: 'test_auth_token',
      phoneNumber: '+15555555555',
    },
  },
}));

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  describe('createNotification', () => {
    it('should create an in-app notification in the database', async () => {
      (Notification.create as jest.Mock).mockResolvedValue({
        _id: 'notif123',
        user: 'user123',
        title: 'Test Title',
        message: 'Test message',
        type: 'system',
      });

      await service.createNotification(
        'user123',
        'Test Title',
        'Test message',
        'system',
        { key: 'value' },
      );

      expect(Notification.create).toHaveBeenCalledWith({
        user: 'user123',
        title: 'Test Title',
        message: 'Test message',
        type: 'system',
        data: { key: 'value' },
      });
    });

    it('should not throw when notification creation fails', async () => {
      (Notification.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      // Should not throw — errors are logged but swallowed
      await expect(
        service.createNotification('user123', 'Title', 'Message'),
      ).resolves.not.toThrow();
    });
  });

  describe('sendPushNotification', () => {
    it('should skip if FCM is not initialized', async () => {
      // FCM is not initialized in test (no service account)
      await service.sendPushNotification('user123', 'Title', 'Body');

      // Should not throw and should not call messaging
      expect(getMessaging).not.toHaveBeenCalled();
    });

    it('should skip if user has no FCM tokens', async () => {
      // Manually set fcmInitialized for this test
      (service as any).fcmInitialized = true;
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ fcmTokens: [] }),
      });

      await service.sendPushNotification('user123', 'Title', 'Body');

      expect(getMessaging).not.toHaveBeenCalled();
    });

    it('should send push to all FCM tokens', async () => {
      (service as any).fcmInitialized = true;
      const mockUser = {
        fcmTokens: ['token1', 'token2'],
      };
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const mockSend = jest.fn().mockResolvedValue('msg-id');
      (getMessaging as jest.Mock).mockReturnValue({ send: mockSend });

      await service.sendPushNotification('user123', 'Title', 'Body', { key: 'val' });

      // Should send to both tokens
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'token1',
          notification: { title: 'Title', body: 'Body' },
        }),
      );
    });

    it('should remove failed tokens from user', async () => {
      (service as any).fcmInitialized = true;
      const mockUser = {
        fcmTokens: ['valid-token', 'invalid-token'],
      };
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const mockSend = jest.fn()
        .mockResolvedValueOnce('msg-id') // valid-token succeeds
        .mockRejectedValueOnce(new Error('Invalid registration')); // invalid-token fails
      (getMessaging as jest.Mock).mockReturnValue({ send: mockSend });
      (User.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

      await service.sendPushNotification('user123', 'Title', 'Body');

      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: 'user123' },
        { $pull: { fcmTokens: { $in: ['invalid-token'] } } },
      );
    });
  });

  describe('sendSMS', () => {
    it('should skip if Twilio client is not initialized', async () => {
      (service as any).twilioClient = null;

      await service.sendSMS('+911234567890', 'Test message');

      // Should not throw — gracefully skips
    });

    it('should send SMS via Twilio when configured', async () => {
      const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM_TEST_123' });
      (service as any).twilioClient = {
        messages: { create: mockCreate },
      };

      await service.sendSMS('+911234567890', 'Emergency alert!');

      expect(mockCreate).toHaveBeenCalledWith({
        body: 'Emergency alert!',
        from: expect.any(String),
        to: '+911234567890',
      });
    });

    it('should throw when SMS delivery fails', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('Invalid phone'));
      (service as any).twilioClient = {
        messages: { create: mockCreate },
      };

      await expect(
        service.sendSMS('+910000000000', 'Test'),
      ).rejects.toThrow('Invalid phone');
    });
  });

  describe('broadcastPush', () => {
    it('should send push to multiple users', async () => {
      const sendPushSpy = jest.spyOn(service, 'sendPushNotification').mockResolvedValue();

      await service.broadcastPush(
        ['user1', 'user2', 'user3'],
        'Broadcast Title',
        'Broadcast Body',
      );

      expect(sendPushSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('broadcastSMS', () => {
    it('should return sent/failed counts', async () => {
      jest.spyOn(service, 'sendSMS')
        .mockResolvedValueOnce() // first succeeds
        .mockRejectedValueOnce(new Error('fail')); // second fails

      const result = await service.broadcastSMS(
        ['+911111111111', '+922222222222'],
        'Alert!',
      );

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });
  });
});
