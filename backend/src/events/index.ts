import { getKafkaProducer, createKafkaConsumer } from '../config/kafka';
import { KafkaTopic, KafkaEvent } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event bridge for Kafka producer/consumer operations.
 * Provides a unified interface for publishing and subscribing to domain events.
 */
export class EventBridge {
  private static isConnected = false;

  /**
   * Publish an event to a Kafka topic.
   * Fire-and-forget with error logging.
   */
  static publish(
    topic: KafkaTopic,
    event: Omit<KafkaEvent, 'timestamp' | 'source' | 'correlationId'>,
  ): void {
    const fullEvent: KafkaEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      source: 'mobility-backend',
      correlationId: uuidv4(),
    };

    // Async publish — don't await to avoid blocking the request
    EventBridge.publishAsync(topic, fullEvent).catch((err) => {
      logger.error('Failed to publish Kafka event', {
        topic,
        eventType: event.eventType,
        error: (err as Error).message,
      });
    });
  }

  private static async publishAsync(
    topic: KafkaTopic,
    event: KafkaEvent,
  ): Promise<void> {
    try {
      const producer = getKafkaProducer();
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

      logger.debug('Kafka event published', {
        topic,
        eventType: event.eventType,
        correlationId: event.correlationId,
      });
    } catch (error) {
      // If Kafka producer is not connected (e.g. dev mode), just log and skip
      if ((error as Error).message === 'Kafka producer not initialized') {
        logger.debug('Kafka not connected — event skipped', {
          topic,
          eventType: event.eventType,
        });
        return;
      }
      throw error;
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
      logger.warn('Failed to subscribe to Kafka topic', { topic, error });
    }
  }

  /**
   * Start all event consumers.
   */
  static async startConsumers(): Promise<void> {
    try {
      // User events consumer
      await EventBridge.subscribe('user-events', 'user-events-group', async (event) => {
        logger.info('User event', { type: event.eventType, data: event.data });
      });

      // Ride events consumer
      await EventBridge.subscribe('ride-events', 'ride-events-group', async (event) => {
        logger.info('Ride event', { type: event.eventType });
        // TODO: Proactive rider notification for ride.created
      });

      // Booking events consumer
      await EventBridge.subscribe('booking-events', 'booking-events-group', async (event) => {
        logger.info('Booking event', { type: event.eventType });
        // TODO: Send push notifications
      });

      // Payment events consumer
      await EventBridge.subscribe('payment-events', 'payment-events-group', async (event) => {
        logger.info('Payment event', { type: event.eventType });
        // TODO: Fraud detection pipeline
      });

      // Safety events consumer
      await EventBridge.subscribe('safety-events', 'safety-events-group', async (event) => {
        logger.info('Safety event', { type: event.eventType });
        // TODO: Admin real-time dashboard alert
      });

      logger.info('All Kafka consumers started');
    } catch (error) {
      logger.warn('Failed to start Kafka consumers — running without event streaming', {
        error: (error as Error).message,
      });
    }
  }
}
