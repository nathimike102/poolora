import http from 'http';
import app from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { connectKafkaProducer, disconnectKafka } from './config/kafka';
import { initializeFirebase } from './config/firebase';
import { SocketGateway } from './sockets/SocketGateway';
import { EventBridge } from './events';
import { logger } from './utils/logger';

const server = http.createServer(app);
const socketGateway = new SocketGateway();

// Dev-default secrets that must NEVER be used in production
const DEV_JWT_SECRETS = [
  'dev-access-secret-change-in-production-min32',
  'dev-refresh-secret-change-in-production-min32',
];

async function bootstrap(): Promise<void> {
  if (config.isProduction) {
    // 1. Required third-party credentials
    const requiredVars = [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
    ];
    for (const key of requiredVars) {
      if (!process.env[key]) throw new Error(`Missing required production env: ${key}`);
    }

    // 2. Reject dev placeholder secrets
    const accessSecret = process.env.JWT_ACCESS_SECRET!;
    const refreshSecret = process.env.JWT_REFRESH_SECRET!;
    if (DEV_JWT_SECRETS.includes(accessSecret) || DEV_JWT_SECRETS.includes(refreshSecret)) {
      throw new Error(
        'Cannot start in production with dev JWT secrets. ' +
        'Generate secure secrets: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
      );
    }

    // 3. Enforce minimum secret length (64 hex chars = 256-bit entropy)
    if (accessSecret.length < 64 || refreshSecret.length < 64) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must each be at least 64 characters.');
    }

    // 4. Reject wildcard CORS in production
    if (process.env.CORS_ORIGIN === '*' || !process.env.CORS_ORIGIN) {
      throw new Error('CORS_ORIGIN must be set to specific domain(s) in production. Wildcard (*) is not allowed.');
    }
  }

  try {
    // 1. Connect to MongoDB
    await connectDatabase();

    // 2. Connect to Redis
    try {
      await connectRedis();
    } catch (error) {
      logger.warn('Redis connection failed — rate limiting and sessions will use fallback', {
        error: (error as Error).message,
      });
    }

    // 3. Initialize Firebase
    try {
      initializeFirebase();
    } catch (error) {
      logger.warn('Firebase initialization skipped', { error: (error as Error).message });
    }

    // 4. Connect Kafka producer
    try {
      await connectKafkaProducer();
      // Start event consumers
      await EventBridge.startConsumers();
    } catch (error) {
      logger.warn('Kafka connection failed — running without event streaming', {
        error: (error as Error).message,
      });
    }

    // 5. Initialize Socket.io gateway
    try {
      socketGateway.initialize(server);
      logger.info('Socket.io gateway initialized');
    } catch (error) {
      logger.warn('Socket.io initialization failed — real-time features disabled', {
        error: (error as Error).message,
      });
    }

    // 6. Start HTTP server
    server.listen(config.port, () => {
      logger.info(`Mobility Backend running on port ${config.port}`, {
        env: config.env,
        port: config.port,
      });
      logger.info(`API Base URL: ${config.app.baseUrl}`);
      logger.info(`Health Check: ${config.app.baseUrl}/health`);
    });
  } catch (error) {
    logger.error('Failed to bootstrap application', { error });
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close Socket.io connections
      socketGateway.getIO()?.close();
      logger.info('Socket.io server closed');

      // Disconnect infrastructure
      await Promise.allSettled([
        disconnectDatabase(),
        disconnectRedis(),
        disconnectKafka(),
      ]);

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  const detail =
    reason instanceof Error
      ? { message: reason.message, stack: reason.stack }
      : { value: String(reason) };
  logger.error('Unhandled Rejection', detail);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start
bootstrap();
