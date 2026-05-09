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
  logger.info('Kafka producer connected');
}

export function getKafkaProducer(): Producer {
  if (!producer) throw new Error('Kafka producer not initialized');
  return producer;
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
  await producer?.disconnect();
  logger.info('Kafka disconnected gracefully');
}
