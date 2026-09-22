import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5001'), 10),
  isProduction: process.env.NODE_ENV === 'production',
  app: {
    // No production default: APP_BASE_URL must be set explicitly in
    // production so a stale hostname can never be served by accident.
    baseUrl:
      process.env.NODE_ENV === 'production'
        ? required('APP_BASE_URL')
        : optional('APP_BASE_URL', `http://localhost:${optional('PORT', '5001')}`),
  },

  mongo: {
    uri: required('MONGO_URI'),
  },

  redis: {
    host: optional('REDIS_HOST', 'localhost'),
    port: parseInt(optional('REDIS_PORT', '6379'), 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiry: optional('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: optional('JWT_REFRESH_EXPIRY', '7d'),
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    // Region-specific Realtime Database instance URL.
    databaseUrl: process.env.FIREBASE_DATABASE_URL || '',
    // Resolved against the working directory so relative paths work with require() too.
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : '',
    // Optional: supply the service account JSON directly via env (base64 or raw JSON).
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: optional('AWS_REGION', 'ap-south-1'),
    s3Bucket: optional('AWS_S3_BUCKET', 'mobility-uploads'),
  },

  twilio: {
    enabled: process.env.TWILIO_ENABLED === 'true',
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  maps: {
    googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  kafka: {
    brokers: optional('KAFKA_BROKERS', 'localhost:9092').split(','),
    clientId: optional('KAFKA_CLIENT_ID', 'mobility-backend'),
  },

  elasticsearch: {
    url: optional('ELASTICSEARCH_URL', 'http://localhost:9200'),
  },

  cors: {
    // Do NOT default to '*' — require explicit origins in production.
    // In development, defaults to localhost:3000 if unset.
    origin: optional(
      'CORS_ORIGIN',
      process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000',
    ).split(',').map((s) => s.trim()).filter(Boolean),
  },

  rateLimit: {
    global: { max: 100, windowMs: 60_000 },
    auth: { max: 10, windowMs: 15 * 60_000 },
    otp: { max: 3, windowMs: 60 * 60_000 },
  },

  session: {
    maxConcurrent: 3,
  },

  tracking: {
    intervalMs: 5_000,
    startBeforePickupMins: 30,
    routeDeviationMeters: 500,
  },

  ride: {
    maxActivePerDriver: 5,
    maxPendingRequestsPerRider: 3,
    maxPickupDistanceFromRouteKm: 2,
    defaultSearchRadiusKm: 5,
    defaultTimeDeviationMins: 120,
    platformFeeRate: parseFloat(process.env.PLATFORM_FEE_RATE || '0.15'), // 15% default
  },

  otp: {
    expirySeconds: 300,
    /**
     * A wrong code makes the next attempt wait longer, doubling each time and
     * capped at backoffMaxSeconds. We deliberately do not suspend the account:
     * anyone who knows a phone number could otherwise lock its owner out by
     * entering wrong codes.
     */
    backoffBaseSeconds: 5,
    backoffMaxSeconds: 900,
    /** Wrong codes before the code is thrown away and a new one is needed. */
    maxAttemptsPerCode: 5,
    /** How long recent failures keep counting towards the delay. */
    failureWindowSeconds: 3600,
  },

  wallet: {
    coinToInrRate: parseFloat(process.env.COIN_TO_INR_RATE || '0.25'), // ₹ per coin
    minTopUpAmount: 50,
    maxTopUpAmount: 50000,
    maxWalletBalance: 100000,
    minCoinConversion: 100,     // minimum coins needed to convert
    coinEarnRates: {            // coins earned per ₹ spent/earned in ride, by tier
      bronze: 1,
      silver: 1.5,
      gold: 2,
      platinum: 3,
      diamond: 5,
    } as Record<string, number>,
    tierThresholds: {           // total completed rides to reach tier
      bronze: 0,
      silver: 10,
      gold: 25,
      platinum: 50,
      diamond: 100,
    } as Record<string, number>,
    bonusCoinsOnTierUpgrade: { // one-time bonus coins when crossing a tier
      silver: 50,
      gold: 150,
      platinum: 400,
      diamond: 1000,
    } as Record<string, number>,
  },

  services: {
    mlServiceUrl: optional('ML_SERVICE_URL', 'http://poolora-ml:8000'),
    mlServiceApiKey: process.env.ML_SERVICE_API_KEY || '',
  },
} as const;
