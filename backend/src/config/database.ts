import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(config.mongo.uri, {
      maxPoolSize: 20,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
    });

    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error('MongoDB connection failed', { error });
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
}
