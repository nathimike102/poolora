import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';

let kafka: Kafka | null = null;
let producer: Producer | null = null;

export function getKafkaInstance(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      logLevel: logLevel.NOTHING,
      retry: {
        initialRetryTime: 300,
        retries: 3,
      },
    });
  }
  return kafka;
}

export async function connectKafkaProducer(): Promise<void> {
  const kafkaInstance = getKafkaInstance();
  producer = kafkaInstance.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30000,
  });

  await producer.connect();
  // A dropped connection makes getKafkaProducer() fail, so events fall back
  // to in-process handling instead of throwing
  producer.on(producer.events.DISCONNECT, () => {
    logger.warn('Kafka producer disconnected');
  });
  logger.info('Kafka producer connected');
}

let connectLoop: NodeJS.Timeout | null = null;

/**
 * Connects the producer in the background, retrying with backoff until it
 * works, then calls `onConnected` once (to start the consumers). Kafka often
 * starts after the API (it takes up to a minute in Docker Compose), and a
 * single attempt at boot used to leave the API without Kafka until restart.
 * Until it connects, events are handled in-process (see EventBridge).
 */
export function connectKafkaInBackground(onConnected: () => Promise<void>): void {
  let delayMs = 2_000;
  const attempt = async () => {
    connectLoop = null;
    try {
      await connectKafkaProducer();
      await onConnected();
    } catch (error) {
      await producer?.disconnect().catch(() => undefined);
      producer = null;
      logger.warn('Kafka not reachable yet; retrying', {
        brokers: config.kafka.brokers,
        retryInSeconds: delayMs / 1000,
        error: (error as Error).message,
      });
      connectLoop = setTimeout(attempt, delayMs);
      connectLoop.unref();
      delayMs = Math.min(delayMs * 2, 60_000);
    }
  };
  void attempt();
}

export function getKafkaProducer(): Producer {
  if (!producer) throw new Error('Kafka producer not initialized');
  return producer;
}

/**
 * Creates any missing topics. A consumer cannot subscribe to a topic that
 * does not exist yet ("This server does not host this topic-partition"), so on
 * a fresh cluster every consumer failed and no notifications were delivered.
 */
export async function ensureKafkaTopics(topics: string[]): Promise<void> {
  const admin = getKafkaInstance().admin();
  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const missing = topics.filter((t) => !existing.has(t));
    if (missing.length > 0) {
      // Replication and partition counts come from the broker's defaults
      await admin.createTopics({ topics: missing.map((topic) => ({ topic })), waitForLeaders: true });
      logger.info('Kafka topics created', { topics: missing });
    }
  } finally {
    await admin.disconnect();
  }
}

export async function createKafkaConsumer(groupId: string): Promise<Consumer> {
  const kafkaInstance = getKafkaInstance();
  const consumer = kafkaInstance.consumer({
    groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  await consumer.connect();
  logger.info(`Kafka consumer connected (group: ${groupId})`);
  return consumer;
}

export async function disconnectKafka(): Promise<void> {
  if (connectLoop) clearTimeout(connectLoop);
  await producer?.disconnect();
  logger.info('Kafka disconnected gracefully');
}
