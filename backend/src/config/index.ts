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

  /**
   * Paynow (paynow.co.zw): EcoCash, OneMoney, InnBucks and Visa/Mastercard.
   * Paynow gives one integration per currency, each with its own id and key.
   * A currency whose integration is not set cannot be paid in.
   */
  paynow: {
    usd: {
      integrationId: process.env.PAYNOW_USD_INTEGRATION_ID || '',
      integrationKey: process.env.PAYNOW_USD_INTEGRATION_KEY || '',
    },
    zwg: {
      integrationId: process.env.PAYNOW_ZWG_INTEGRATION_ID || '',
      integrationKey: process.env.PAYNOW_ZWG_INTEGRATION_KEY || '',
    },
    /**
     * Sent as authemail when the payer has no email on their profile. In
     * test mode it must be the email of the Paynow merchant account.
     */
    authEmail: process.env.PAYNOW_AUTH_EMAIL || '',
    initiateUrl: optional('PAYNOW_INITIATE_URL', 'https://www.paynow.co.zw/interface/initiatetransaction'),
    remoteUrl: optional('PAYNOW_REMOTE_URL', 'https://www.paynow.co.zw/interface/remotetransaction'),
  },

  /**
   * ZiG (ZWG) per US dollar, for riders who pay in ZiG. Prices and wallets
   * stay in US dollars. 0 turns ZiG payments off. Admin-editable.
   */
  zwgPerUsd: parseFloat(process.env.ZWG_PER_USD || '0'),

  /**
   * Background checks and licence/registration verification by a vendor
   * (UC-A01). Set KYC_VERIFY_URL to the vendor's endpoint, or to a small
   * adapter in front of it, and KYC_VERIFY_API_KEY. Without it, only the
   * automatic checks in DocumentCheckService run.
   */
  kycVerify: {
    url: process.env.KYC_VERIFY_URL || '',
    apiKey: process.env.KYC_VERIFY_API_KEY || '',
  },

  trackers: {
    /**
     * Car GPS trackers reach Poolora through a Traccar gateway (forwarder
     * only), which posts each position with this key in X-Poolora-Tracker-Key.
     * Empty turns the endpoint off.
     */
    gatewayKey: process.env.TRACKER_GATEWAY_KEY || '',
    /** Where drivers point their tracker: shown in the app */
    gatewayHost: process.env.TRACKER_GATEWAY_HOST || '',
    gatewayPort: Number(process.env.TRACKER_GATEWAY_PORT || 5023),
  },

  admin: {
    /** Where the web admin is served, for links in alert emails */
    webUrl: (process.env.ADMIN_WEB_URL || '').replace(/\/$/, ''),
  },

  parcel: {
    /** Drivers must photograph the parcel at pickup and at delivery (UC-P03). PARCEL_PHOTO_PROOF=optional turns it off. */
    photoProofRequired: process.env.PARCEL_PHOTO_PROOF !== 'optional',
    /** Days after delivery a damage claim can be filed (UC-P05) */
    claimWindowDays: 7,
    /** Hours past the expected delivery time before a parcel can be claimed as lost */
    lostAfterHours: 24,
  },

  /**
   * Parcel insurance claims (UC-P05). With INSURANCE_CLAIMS_URL set, each
   * claim is also sent to the insurer's API; otherwise admins decide claims.
   */
  insurance: {
    claimsUrl: process.env.INSURANCE_CLAIMS_URL || '',
    apiKey: process.env.INSURANCE_API_KEY || '',
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: optional('AWS_REGION', 'af-south-1'),
    s3Bucket: optional('AWS_S3_BUCKET', 'mobility-uploads'),
  },

  twilio: {
    enabled: process.env.TWILIO_ENABLED === 'true',
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    /**
     * Masked calls between riders and drivers (UC-D06) go through this number,
     * so neither side sees the other's. Falls back to TWILIO_PHONE_NUMBER.
     */
    voiceNumber: process.env.TWILIO_VOICE_NUMBER || process.env.TWILIO_PHONE_NUMBER || '',
    /** Record masked calls for safety reviews (UC-A03); both sides hear a notice */
    recordCalls: process.env.CALL_RECORDING !== 'false',
  },

  /**
   * Live video during an SOS (UC-X04), through LiveKit. Unset, the app never
   * offers video and the SOS works as before. LIVEKIT_URL is the wss:// URL
   * of the LiveKit Cloud project (or a self-hosted server).
   */
  video: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
    /**
     * Keys LiveKit is given to write recordings into the uploads bucket. Their
     * own IAM user, allowed only s3:PutObject on sos/*, never the backend's
     * keys (which can read identity documents). Without them nothing is recorded.
     */
    recordingAccessKeyId: process.env.LIVEKIT_RECORDING_AWS_ACCESS_KEY_ID || '',
    recordingSecretAccessKey: process.env.LIVEKIT_RECORDING_AWS_SECRET_ACCESS_KEY || '',
  },

  maps: {
    googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || '',
    /**
     * 'google' or 'osm'. OSM uses free OpenStreetMap services (Photon for
     * suggestions, Nominatim for addresses, OSRM for routes) and needs no key.
     * Defaults to Google when a key is set, otherwise OSM.
     */
    provider: (process.env.MAPS_PROVIDER
      || (process.env.GOOGLE_MAPS_API_KEY ? 'google' : 'osm')) as 'google' | 'osm',
    // The public instances are for light use; point these at your own for production.
    photonUrl: optional('PHOTON_URL', 'https://photon.komoot.io'),
    nominatimUrl: optional('NOMINATIM_URL', 'https://nominatim.openstreetmap.org'),
    osrmUrl: optional('OSRM_URL', 'https://router.project-osrm.org'),
    // Nominatim's usage policy asks every client to identify itself.
    osmUserAgent: optional('OSM_USER_AGENT', 'Poolora/1.0 (poolora carpooling app)'),
  },

  simulation: {
    // Dev tool that drives a ride along its route. Never on in production
    // unless explicitly asked for.
    enabled: process.env.ENABLE_RIDE_SIMULATION
      ? process.env.ENABLE_RIDE_SIMULATION === 'true'
      : process.env.NODE_ENV !== 'production',
  },

  kafka: {
    /** Set KAFKA_ENABLED=false to run without Kafka and stop the reconnect attempts. */
    enabled: process.env.KAFKA_ENABLED !== 'false',
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

  /**
   * Limits are keyed by what is being protected. Mobile networks put many
   * subscribers behind one public IP (carrier-grade NAT), so per-IP limits
   * are only a high ceiling against one source flooding; the real limits are
   * per signed-in user and per phone number.
   */
  rateLimit: {
    /** Per IP, every request */
    global: { max: parseInt(process.env.RATE_LIMIT_IP_PER_MIN || '1000', 10), windowMs: 60_000 },
    /** Per signed-in user, every authenticated request */
    user: { max: parseInt(process.env.RATE_LIMIT_USER_PER_MIN || '120', 10), windowMs: 60_000 },
    /** Per IP: token refresh and Firebase sign-in */
    auth: { max: 300, windowMs: 15 * 60_000 },
    /** Per phone number: codes sent (UC-R01: 3 an hour) */
    otp: { max: 3, windowMs: 60 * 60_000 },
    /** Per IP: codes sent, whatever the number */
    otpIp: { max: 30, windowMs: 60 * 60_000 },
    /** Per phone number: code checks */
    verify: { max: 10, windowMs: 15 * 60_000 },
    /** Per IP: code checks */
    verifyIp: { max: 100, windowMs: 15 * 60_000 },
  },

  session: {
    maxConcurrent: 3,
  },

  accountClosure: {
    /** How long a closed account's number is remembered, so new-user perks are not given to it again */
    rememberPhoneDays: parseInt(optional('CLOSED_PHONE_REMEMBER_DAYS', '365'), 10),
    /** Key for the hash of those numbers; changing it forgets every remembered number */
    phoneHashSecret: process.env.PHONE_HASH_SECRET || required('JWT_ACCESS_SECRET'),
  },

  tracking: {
    intervalMs: 5_000,
    startBeforePickupMins: 30,
    /** A car further than this from its planned route raises a deviation alert (UC-R05). Admin-editable. */
    routeDeviationMeters: 500,
  },

  safety: {
    /**
     * During an SOS the phone sends its position every 5 seconds. It should
     * be heard from at least this often, by risk level; three intervals of
     * silence mark it out of contact and page the safety team. Admin-editable.
     */
    checkInSeconds: { low: 120, medium: 60, high: 30 },
    /**
     * The safety team is alerted the moment an SOS is raised. Emergency
     * contacts are texted after this many seconds, so an accidental press can
     * be cancelled first (UC-R07 3a). Admin-editable.
     */
    contactDelaySeconds: 10,
    /**
     * An SOS raised because the rider missed two check-ins (a phone in a bag
     * looks the same) gives them this long to answer before their contacts
     * are texted. The safety team is paged at once.
     */
    autoContactDelaySeconds: 300,
    /** An SOS nobody has taken after this pages every admin again, at each interval (UC-A03: 5 minutes). Admin-editable. */
    ackTargetMins: 5,
    /**
     * Record SOS video with the incident's evidence (sos/<id>/), as SOS audio
     * is. Off until legal advice confirms recording in the car is allowed in
     * the market; live video works either way. Admin-editable.
     */
    recordVideo: process.env.SOS_VIDEO_RECORDING === 'true',
    /** A false alarm's record, with its location trail, is deleted after this; real incidents are kept */
    falseAlarmRetentionDays: 90,
    /** The SOS tracking link works for this long */
    trackingTokenTtlSeconds: 7 * 24 * 3600,
  },

  matching: {
    /** Weights of the ride match score; they sum to 1. Admin-editable. */
    weights: { proximity: 0.4, time: 0.3, rating: 0.15, acceptance: 0.1, safety: 0.05 },
    /** Score search results with the ML service's /api/match (falls back to local scoring) */
    useMlService: process.env.ML_MATCHING === 'true',
  },

  ride: {
    maxActivePerDriver: 5,
    maxPendingRequestsPerRider: 3,
    maxPickupDistanceFromRouteKm: 2,
    /** Stops a rider may add between their pickup and drop (as on Rapido and Uber). Admin-editable. */
    maxStopsPerBooking: 2,
    /** Added to the fare for each stop the rider adds, once per booking, in the market's currency. Admin-editable. */
    extraStopFee: 0.5,
    defaultSearchRadiusKm: 5,
    defaultTimeDeviationMins: 120,
    platformFeeRate: parseFloat(process.env.PLATFORM_FEE_RATE || '0.15'), // 15% default
    /** Commission on the part of a fare a company pays (UC-C01; decided 2 October 2026) */
    companyFeeRate: parseFloat(process.env.COMPANY_FEE_RATE || '0.10'),
    /**
     * When a rider cancels a confirmed seat, keep the platform fee on the whole
     * fare instead of refunding it with the fare (UC-R09 "platform fee is
     * non-refundable"). Off by default. Admin-editable, with a second admin's approval.
     */
    keepPlatformFeeOnCancel: process.env.KEEP_PLATFORM_FEE_ON_CANCEL === 'true',
    /** Requests paid online still unpaid after this are cancelled (UC-R04). */
    paymentTimeoutMins: 15,
    /** Requests the driver has not answered after this expire (UC-D03). */
    requestExpiryHours: 6,
    /** Rides with nobody booked are cancelled this long before departure (UC-D02). */
    emptyRideCancelMins: 60,
    /**
     * Refund when a rider cancels a confirmed booking (UC-R09), by hours left
     * before departure. The first tier whose `minHours` is met applies. Most
     * seats are same-day commutes, and taxi apps and kombis here charge riders
     * nothing to cancel, so half comes back until 2 hours before; after that
     * the driver is unlikely to fill the seat and keeps the fare.
     */
    riderCancellationRefunds: [
      { minHours: 24, refundRate: 1 },
      { minHours: 2, refundRate: 0.5 },
      { minHours: 0, refundRate: 0 },
    ],
    /**
     * A rider who cancels within this long of the driver accepting gets
     * everything back, whatever the tier, as long as the ride leaves at
     * least riderFreeCancelLeadMins later. Covers a mistaken or duplicate
     * booking without letting a seat be held until the last minute.
     */
    riderFreeCancelMins: 30,
    riderFreeCancelLeadMins: 60,
    /** How often the booking sweeper runs. */
    sweepIntervalMs: 60_000,
    /** How long a driver waits at a pickup before reporting a no-show (UC-D07). Admin-editable. */
    noShowWaitMins: 10,
    /** Rides can be edited until this long before departure (UC-D08) */
    editCutoffHours: 4,
    /** How far an edit may move the departure time (UC-D08) */
    maxDepartureShiftHours: 2,
    /** Price change allowed on a ride nobody has booked yet (UC-D08) */
    maxPriceChangeRate: 0.2,
    /** Minutes between "Are you OK?" prompts during a ride (UC-R05). Admin-editable. */
    safetyCheckInMins: 30,
    /** Unanswered prompts are repeated after this, and the second miss raises an SOS */
    safetyCheckInGraceMins: 10,
  },

  otp: {
    expirySeconds: 300,
    /** Once a new user's code is proven, the profile form gets its own window */
    profileWindowSeconds: 600,
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
    coinToUsdRate: parseFloat(process.env.COIN_TO_USD_RATE || '0.01'), // US$ per coin
    minTopUpAmount: 1,
    maxTopUpAmount: 500,
    maxWalletBalance: 1000,
    minCoinConversion: 100,     // minimum coins needed to convert
    coinEarnRates: {            // coins earned per US$ spent/earned in ride, by tier
      bronze: 10,
      silver: 15,
      gold: 20,
      platinum: 30,
      diamond: 50,
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

  /**
   * CO₂ saved by shared seats (UC-R11, docs/planning/12-NEXT-PHASES.md §1).
   * kg CO₂ per km for a typical petrol car of each class: round figures of
   * the order of the UK government's conversion factors. Zimbabwe's fleet is
   * older, so these understate the saving rather than overstate it.
   */
  carbon: {
    /** The car a rider would otherwise have driven alone */
    baselineKgPerKm: parseFloat(process.env.CARBON_BASELINE_KG_PER_KM || '0.17'),
    kgPerKm: {
      hatchback: 0.14,
      mini: 0.14,
      sedan: 0.17,
      suv: 0.21,
      minivan: 0.21,
      pickup: 0.21,
      bike: 0.11,
      auto: 0.09,
    } as Record<string, number>,
  },

  /**
   * Product analytics (docs/ANALYTICS_PLAN.md). The admin's Analytics page
   * always works; PostHog only receives events in production with a key, so
   * development and staging never reach the live project.
   */
  analytics: {
    posthogKey: process.env.POSTHOG_API_KEY || '',
    posthogHost: optional('POSTHOG_HOST', 'https://eu.i.posthog.com'),
  },

  services: {
    mlServiceUrl: optional('ML_SERVICE_URL', 'http://poolora-ml:8000'),
    mlServiceApiKey: process.env.ML_SERVICE_API_KEY || '',
  },
} as const;
