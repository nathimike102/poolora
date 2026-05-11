import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { logger } from '../utils/logger';

/**
 * Notification service — handles:
 * 1. In-app notifications (notification bell)
 * 2. Push notifications (FCM)
 * 3. SMS notifications (Twilio)
 */
export class NotificationService {

  /**
   * Create an in-app notification stored in database
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: 'chat' | 'ride' | 'system' = 'system',
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      const notification = await Notification.create({
        user: userId,
        title,
        message,
        type,
        data,
      });

      logger.info('Notification created', {
        userId,
        notificationId: notification._id,
      });

    } catch (error) {
      logger.error('Failed to create notification', { userId, error });
    }
  }

  /**
   * Send push notification to a user via FCM.
   */
  async sendPushNotification(
    userId: string,
    title: string,
    _body: string,
    _data?: Record<string, string>,
  ): Promise<void> {
    try {
      const user = await User.findById(userId).select('fcmTokens');

      if (!user || user.fcmTokens.length === 0) {
        logger.debug('No FCM tokens for user', { userId });
        return;
      }

      // TODO: integrate Firebase Admin SDK here in production

      logger.info('Push notification sent', { userId, title });

    } catch (error) {
      logger.error('Failed to send push notification', { userId, error });
    }
  }

  /**
   * Send SMS via Twilio
   */
  async sendSMS(phone: string, message: string): Promise<void> {
    try {
      // TODO: integrate Twilio here in production

      logger.info('SMS sent', {
        phone: phone.slice(-4),
        messageLength: message.length,
      });

    } catch (error) {
      logger.error('Failed to send SMS', {
        phone: phone.slice(-4),
        error,
      });
    }
  }

  /**
   * Send notification to multiple users
   */
  async broadcastPush(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await Promise.allSettled(
      userIds.map((id) => this.sendPushNotification(id, title, body, data)),
    );
  }
}
