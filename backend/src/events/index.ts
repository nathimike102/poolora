import { getKafkaProducer, createKafkaConsumer, ensureKafkaTopics } from '../config/kafka';
import { KafkaTopic, KafkaEvent } from '../types';
import { logger } from '../utils/logger';
import type { ObjectSchema } from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

import { eventSchemas } from '../validators/eventValidators';
import { Types } from 'mongoose';
import { money } from '../config/region';
import { localTime } from '../config/region';
import { trackDomainEvent } from '../services/ProductAnalyticsService';
import { phrase } from '../i18n';

/**
 * Callers pass Mongoose documents' ids (ObjectIds) straight through, but the
 * event schemas and consumers expect strings. Convert them before validating,
 * or production drops the event.
 *
 * Only plain objects and arrays are walked. A Mongoose document or
 * subdocument (such as `ride.pickup`) points back at its parent, so walking
 * it never ends; it is turned into a plain object first. `ancestors` stops any
 * cycle through the current path.
 */
export function normalizeIds(value: unknown, ancestors = new Set<object>()): unknown {
  if (value instanceof Types.ObjectId) return value.toString();
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (ancestors.has(value)) return undefined; // a cycle
  const toObject = (value as { toObject?: () => unknown }).toObject;
  if (typeof toObject === 'function') return normalizeIds(toObject.call(value), ancestors);
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return value;
  ancestors.add(value);
  const out = Array.isArray(value)
    ? value.map((v) => normalizeIds(v, ancestors))
    : Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeIds(v, ancestors)]));
  ancestors.delete(value);
  return out;
}

/** Every topic the backend publishes to; created at startup if missing. */
const ALL_TOPICS: readonly KafkaTopic[] = [
  'user-events',
  'ride-events',
  'booking-events',
  'payment-events',
  'safety-events',
  'location-events',
];

/**
 * Event bridge for Kafka producer/consumer operations.
 * Provides a unified interface for publishing and subscribing to domain events.
 */
export class EventBridge {
  private static isConnected = false;

  /**
   * Publish an event to a Kafka topic.
   * Includes schema validation and structured logging.
   */
  static publish(
    topic: KafkaTopic,
    rawEvent: Omit<KafkaEvent, 'timestamp' | 'source' | 'correlationId'>,
  ): void {
    const event = { ...rawEvent, data: normalizeIds(rawEvent.data) as KafkaEvent['data'] };
    // ─── Schema Validation ───
    const schema = (eventSchemas as Record<string, ObjectSchema | undefined>)[event.eventType];
    if (schema) {
      const { error } = schema.validate(event.data);
      if (error) {
        logger.error('Kafka event validation failed', {
          eventType: event.eventType,
          error: error.details[0].message,
          data: event.data,
        });
        // In production, we might want to throw or skip. 
        // For now, we log and proceed but this should be production-hardened.
        if (config.isProduction) return; 
      }
    } else {
      logger.warn('No validation schema found for event type', { eventType: event.eventType });
    }

    const fullEvent: KafkaEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      source: 'mobility-backend',
      correlationId: uuidv4(),
    };

    trackDomainEvent(event.eventType, event.data);

    // Async publish — don't await to avoid blocking the request
    EventBridge.publishAsync(topic, fullEvent).catch((err) => {
      logger.error('Failed to publish Kafka event', {
        topic,
        eventType: event.eventType,
        error: (err as Error).message,
      });
    });
  }

  /**
   * Alias for publish() to maintain compatibility with legacy code.
   * @deprecated Use EventBridge.publish() instead.
   */
  static emit(eventType: string, data: unknown): void {
    // Determine topic based on event type prefix
    let topic: KafkaTopic = 'user-events';
    if (eventType.startsWith('ride.')) topic = 'ride-events';
    else if (eventType.startsWith('booking.')) topic = 'booking-events';
    else if (eventType.startsWith('payment.')) topic = 'payment-events';
    else if (eventType.startsWith('driver.location.')) topic = 'location-events';
    else if (eventType.startsWith('sos.')) topic = 'safety-events';
    else if (eventType.startsWith('parcel:')) topic = 'ride-events'; // Parcel uses ride-events group

    EventBridge.publish(topic, { eventType, data });
  }

  private static async publishAsync(
    topic: KafkaTopic,
    event: KafkaEvent,
  ): Promise<void> {
    const { withRetry } = await import('../utils/helpers');

    try {
      const producer = getKafkaProducer();
      await withRetry(async () => {
        await producer.send({
          topic,
          messages: [
            {
              key: event.correlationId,
              value: JSON.stringify(event),
              headers: {
                eventType: event.eventType,
                timestamp: event.timestamp,
                source: event.source,
              },
            },
          ],
        });
      });

      logger.debug('Kafka event published', {
        topic,
        eventType: event.eventType,
        correlationId: event.correlationId,
      });
    } catch (error) {
      // Kafka is down or not configured: handle the event here instead, so
      // the notifications it drives are not lost
      logger.debug('Kafka unavailable; handling event in-process', {
        topic,
        eventType: event.eventType,
        reason: (error as Error).message,
      });
      await EventBridge.dispatchLocally(topic, event);
    }
  }

  /**
   * Subscribe to a Kafka topic with a handler.
   */
  static async subscribe(
    topic: KafkaTopic,
    groupId: string,
    handler: (event: KafkaEvent) => Promise<void>,
  ): Promise<void> {
    try {
      const consumer = await createKafkaConsumer(groupId);

      await consumer.subscribe({ topic, fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ message }) => {
          try {
            const event: KafkaEvent = JSON.parse(message.value!.toString());
            logger.debug('Kafka event received', {
              topic,
              eventType: event.eventType,
              correlationId: event.correlationId,
            });
            await handler(event);
          } catch (error) {
            logger.error('Error processing Kafka event', {
              topic,
              error: (error as Error).message,
            });
          }
        },
      });

      EventBridge.isConnected = true;
      logger.info(`Kafka consumer subscribed to ${topic}`);
    } catch (error) {
      logger.warn('Failed to subscribe to Kafka topic', { topic, error: (error as Error).message });
    }
  }

  /**
   * The handlers behind each topic. Kafka consumers run them when Kafka is up;
   * when it is not, `publish` runs them in-process so notifications still go
   * out on a single server without Kafka.
   */
  private static handlers = new Map<KafkaTopic, { groupId: string; handler: (event: KafkaEvent) => Promise<void> }>();

  private static register(
    topic: KafkaTopic,
    groupId: string,
    handler: (event: KafkaEvent) => Promise<void>,
  ): void {
    EventBridge.handlers.set(topic, { groupId, handler });
  }

  private static ensureHandlers(): void {
    if (EventBridge.handlers.size === 0) EventBridge.registerHandlers();
  }

  /** Runs an event's handler in this process, for when Kafka cannot deliver it. */
  static async dispatchLocally(topic: KafkaTopic, event: KafkaEvent): Promise<void> {
    EventBridge.ensureHandlers();
    const entry = EventBridge.handlers.get(topic);
    if (!entry) return;
    try {
      await entry.handler(event);
    } catch (error) {
      logger.error('Error handling event in-process', {
        topic,
        eventType: event.eventType,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Subscribe a Kafka consumer group to every topic that has a handler.
   */
  static async startConsumers(): Promise<void> {
    EventBridge.ensureHandlers();
    await ensureKafkaTopics([...ALL_TOPICS]);
    for (const [topic, { groupId, handler }] of EventBridge.handlers) {
      await EventBridge.subscribe(topic, groupId, handler);
    }
    logger.info('All Kafka consumers started');
  }

  private static registerHandlers(): void {
    // User events consumer
    EventBridge.register('user-events', 'user-events-group', async (event) => {
      // The type only: user events carry phone numbers
      logger.info('User event', { type: event.eventType });
    });

    // Ride events consumer — notify riders about new rides matching their saved routes
    EventBridge.register('ride-events', 'ride-events-group', async (event) => {
      logger.info('Ride event', { type: event.eventType });
      if (event.eventType === 'ride.created') {
        const { NotificationService } = await import('../services/NotificationService');
        const notificationService = new NotificationService();
        const data = event.data as { driverId?: string; rideId?: string };
        if (data.driverId && data.rideId) {
          await notificationService.createNotification(
            data.driverId,
            phrase('ride.published.title'),
            phrase('ride.published.body'),
            'ride',
            { rideId: data.rideId },
          );
        }
      } else if (event.eventType === 'ride.cancelled') {
        const data = event.data as { rideId?: string; driverId?: string; reason?: string; automatic?: boolean };
        if (data.automatic && data.driverId) {
          const { NotificationService } = await import('../services/NotificationService');
          const notificationService = new NotificationService();
          await notificationService.sendPushNotification(
            data.driverId,
            phrase('ride.autoCancelled.title'),
            // A given reason is the server's own English sentence for now
            phrase('ride.autoCancelled.body', { reason: data.reason || phrase('ride.autoCancelled.defaultReason') }),
            { rideId: data.rideId ?? '', type: 'ride' },
          );
        }
      } else if (event.eventType === 'ride.updated') {
        const data = event.data as { rideId?: string; changed?: string[]; departureTime?: string; riderIds?: string[]; freeCancellation?: boolean };
        const { NotificationService } = await import('../services/NotificationService');
        const notificationService = new NotificationService();
        const when = data.departureTime
          ? localTime(data.departureTime, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
          : '';
        const changed = data.changed ?? [];
        const body = data.freeCancellation
          ? phrase('ride.changed.time', { when })
          : changed.length === 1 && (changed[0] === 'seats' || changed[0] === 'price')
            ? phrase(`ride.changed.${changed[0]}`)
            : phrase('ride.changed.several', { fields: changed.join(' and ') });
        const title = phrase('ride.changed.title');
        for (const riderId of data.riderIds ?? []) {
          await notificationService.sendPushNotification(riderId, title, body, { rideId: data.rideId ?? '', type: 'ride' });
          await notificationService.createNotification(riderId, title, body, 'ride', { rideId: data.rideId ?? '' });
        }
      } else if (event.eventType === 'ride.started') {
        const { NotificationService } = await import('../services/NotificationService');
        const notificationService = new NotificationService();
        const data = event.data as { rideId?: string; riderIds?: string[] };
        for (const riderId of data.riderIds ?? []) {
          await notificationService.sendPushNotification(
            riderId,
            phrase('ride.started.title'),
            phrase('ride.started.body'),
            { rideId: data.rideId ?? '', type: 'ride' },
          );
        }
      }
    });

    // Booking events consumer — send push notifications for booking state changes
    EventBridge.register('booking-events', 'booking-events-group', async (event) => {
      logger.info('Booking event', { type: event.eventType });
      const { NotificationService } = await import('../services/NotificationService');
      const notificationService = new NotificationService();
      const data = event.data as { riderId?: string; driverId?: string; bookingId?: string; status?: string };

      if (event.eventType === 'booking.created' && data.driverId) {
        await notificationService.sendPushNotification(
          data.driverId,
          phrase('booking.requested.title'),
          phrase('booking.requested.push'),
          { bookingId: data.bookingId || '', type: 'booking' },
        );
        await notificationService.createNotification(
          data.driverId,
          phrase('booking.requested.title'),
          phrase('booking.requested.body'),
          'ride',
          { bookingId: data.bookingId ?? '' },
        );
      } else if (event.eventType === 'booking.confirmed' && data.riderId) {
        await notificationService.sendPushNotification(
          data.riderId,
          phrase('booking.confirmed.title'),
          phrase('booking.confirmed.body'),
          { bookingId: data.bookingId || '', type: 'booking' },
        );
      } else if (event.eventType === 'booking.cancelled' && data.riderId) {
        await notificationService.sendPushNotification(
          data.riderId,
          phrase('booking.cancelled.title'),
          phrase('booking.cancelled.body'),
          { bookingId: data.bookingId || '', type: 'booking' },
        );
      } else if (event.eventType === 'booking.driver_arrived' && data.riderId) {
        const waitMins = (event.data as { waitMins?: number }).waitMins ?? 10;
        await notificationService.sendPushNotification(
          data.riderId,
          phrase('booking.arrived.title'),
          phrase('booking.arrived.body', { minutes: waitMins }),
          { bookingId: data.bookingId || '', type: 'ride' },
        );
      } else if (event.eventType === 'booking.no_show' && data.riderId) {
        await notificationService.sendPushNotification(
          data.riderId,
          phrase('booking.noShow.title'),
          phrase('booking.noShow.body'),
          { bookingId: data.bookingId || '', type: 'booking' },
        );
      } else if (event.eventType === 'booking.expired' && data.riderId) {
        const reason = (event.data as { reason?: string }).reason;
        await notificationService.sendPushNotification(
          data.riderId,
          phrase('booking.expired.title'),
          phrase('booking.expired.body', { reason: reason || phrase('booking.expired.defaultReason') }),
          { bookingId: data.bookingId || '', type: 'booking' },
        );
      }
    });

    // Payment events consumer — fraud detection pipeline
    EventBridge.register('payment-events', 'payment-events-group', async (event) => {
      logger.info('Payment event', { type: event.eventType });
      const data = event.data as { userId?: string; amount?: number; bookingId?: string; paymentId?: string };

      if (event.eventType === 'payment.captured' && data.userId) {
        const { NotificationService } = await import('../services/NotificationService');
        const notificationService = new NotificationService();
        await notificationService.createNotification(
          data.userId,
          phrase('payment.succeeded.title'),
          phrase('payment.succeeded.body', { amount: money(data.amount || 0) }),
          'system',
          { bookingId: data.bookingId ?? '', paymentId: data.paymentId ?? '' },
        );
      } else if (event.eventType === 'payment.failed' && data.userId) {
        logger.warn('Payment failure detected — starting fraud analysis', {
          userId: data.userId,
          paymentId: data.paymentId,
          orderId: (data as { orderId?: string }).orderId,
          amount: data.amount,
        });

        try {
          const { FraudDetectionService } = await import('../services/FraudDetectionService');
          const fraudService = new FraudDetectionService();
          const result = await fraudService.analyzePaymentFailure(data.userId, data);
          
          if (result.shouldBlock) {
            logger.error('User suspended for fraud review', { userId: data.userId, flags: result.flags });
          } else if (result.riskLevel === 'high') {
            logger.warn('User flagged for review after fraud analysis', { userId: data.userId, flags: result.flags });
          }
        } catch (error) {
          logger.error('Failed to run fraud analysis pipeline', {
            userId: data.userId,
            error: (error as Error).message,
          });
        }
      }
    });

    // Safety events consumer — broadcast to admin dashboard via SocketGateway
    EventBridge.register('safety-events', 'safety-events-group', async (event) => {
      logger.info('Safety event', { type: event.eventType });

      if (
        event.eventType === 'sos.triggered' ||
        event.eventType === 'sos.location.updated' ||
        event.eventType === 'sos.escalated' ||
        event.eventType === 'sos.updated' ||
        event.eventType === 'sos.resolved' ||
        event.eventType === 'sos.police_notified'
      ) {
        const { SocketGateway } = await import('../sockets/SocketGateway');
        const gateway = SocketGateway.getInstance();
        if (gateway) {
          const io = gateway.getIO();
          io.to('admin:sos').emit('sos:alert', {
            eventType: event.eventType,
            data: event.data,
            timestamp: event.timestamp,
          });
        }
      }
    });
  }
}
