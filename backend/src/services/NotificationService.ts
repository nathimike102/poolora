import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import twilio from 'twilio';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Notification service. Handles:
 * 1. In-app notifications (notification bell)
 * 2. Push notifications (FCM)
 * 3. SMS notifications (Twilio)
 */
export class NotificationService {
  private fcmInitialized: boolean = false;
  private twilioClient: ReturnType<typeof twilio> | null = null;

  constructor() {
    this.initializeFCM();
    this.initializeTwilio();
  }

  /**
   * Initialize Firebase Admin SDK for push notifications
   */
  private initializeFCM(): void {
    try {
      if (!getApps().length) {
        const serviceAccountJson = config.firebase.serviceAccountJson
          ? JSON.parse(config.firebase.serviceAccountJson)
          : require(config.firebase.serviceAccountPath);

        if (serviceAccountJson.project_id) {
          initializeApp({
            credential: cert(serviceAccountJson),
            projectId: config.firebase.projectId || serviceAccountJson.project_id,
          });
          this.fcmInitialized = true;
          logger.info('Firebase Admin SDK initialized');
        }
      }
    } catch (error) {
      logger.warn('Firebase Admin SDK initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.fcmInitialized = false;
    }
  }

  /**
   * Initialize Twilio client for SMS
   */
  private initializeTwilio(): void {
    try {
      if (!config.twilio.enabled) {
        logger.info('Twilio is disabled via config');
        this.twilioClient = null;
        return;
      }

      if (
        config.twilio.accountSid &&
        config.twilio.authToken &&
        config.twilio.phoneNumber
      ) {
        this.twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
        logger.info('Twilio client initialized');
      }
    } catch (error) {
      logger.warn('Twilio initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.twilioClient = null;
    }
  }

  /**
   * Create an in-app notification stored in database
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: 'chat' | 'ride' | 'system' = 'system',
    data?: Record<string, string>,
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
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      if (!this.fcmInitialized) {
        logger.debug('FCM not initialized, skipping push notification', { userId });
        return;
      }

      const user = await User.findById(userId).select('fcmTokens');

      if (!user || user.fcmTokens.length === 0) {
        logger.debug('No FCM tokens for user', { userId });
        return;
      }

      const messaging = getMessaging();
      const failedTokens: string[] = [];

      // Send to all tokens in parallel
      const results = await Promise.allSettled(
        user.fcmTokens.map((token) =>
          messaging.send({
            token,
            notification: {
              title,
              body,
            },
            data: data || {},
            android: {
              priority: 'high',
              notification: {
                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              },
            },
            apns: {
              headers: {
                'apns-priority': '10',
              },
            },
          })
        )
      );

      // Track failed tokens for cleanup
      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          failedTokens.push(user.fcmTokens[idx]);
        }
      });

      // Remove invalid tokens
      if (failedTokens.length > 0) {
        await User.updateOne(
          { _id: userId },
          { $pull: { fcmTokens: { $in: failedTokens } } }
        );
      }

      logger.info('Push notification sent', {
        userId,
        title,
        tokensCount: user.fcmTokens.length,
        failedTokens: failedTokens.length,
      });

    } catch (error) {
      logger.error('Failed to send push notification', { userId, error });
    }
  }

  /**
   * Send SMS via Twilio
   */
  async sendSMS(phone: string, message: string): Promise<void> {
    try {
      if (!config.twilio.enabled) {
        logger.debug('Twilio disabled, skipping SMS', {
          phone: phone.slice(-4),
        });
        return;
      }

      if (!this.twilioClient) {
        logger.debug('Twilio not initialized, skipping SMS', {
          phone: phone.slice(-4),
        });
        return;
      }

      const result = await this.twilioClient.messages.create({
        body: message,
        from: config.twilio.phoneNumber,
        to: phone,
      });

      logger.info('SMS sent', {
        phone: phone.slice(-4),
        messageLength: message.length,
        sid: result.sid,
      });

    } catch (error) {
      logger.error('Failed to send SMS', {
        phone: phone.slice(-4),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
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

  /**
   * Send SMS to multiple recipients
   */
  async broadcastSMS(
    phones: string[],
    message: string,
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      phones.map((phone) => this.sendSMS(phone, message)),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info('Broadcast SMS completed', { sent, failed, totalRecipients: phones.length });
    return { sent, failed };
  }
}
