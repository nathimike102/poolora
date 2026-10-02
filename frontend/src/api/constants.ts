/**
 * api/constants.ts
 * 
 * API endpoints and configuration constants
 */

import { env } from '../config/env';
import i18n from '../i18n';


// ─── API Base URL Configuration ────────────────────────────────────────────
// Values come from `config/env`, which reads them through the '@env' module
// that react-native-dotenv inlines at build time. `process.env` is NOT
// populated in the React Native runtime under this Babel setup, so reading it
// here would silently yield undefined in every build.
//
// There is deliberately no production default: the API host is supplied at
// build time so a hostname is never baked into a shipped binary, where it
// could not be changed without a new release. Development falls back to a
// local backend; a release build with the host unset throws here rather than
// failing later as an opaque network error.
const DEV_BASE_URL = 'http://localhost:5002';

function resolveBaseUrl(): string {
  const fromEnv = env.REACT_NATIVE_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (__DEV__) return DEV_BASE_URL;
  throw new Error(
    'REACT_NATIVE_API_BASE_URL is not set. Release builds must be built with ' +
      'the API host in the environment; see frontend/.env.example.',
  );
}

export const API_CONFIG = {
  baseUrl: resolveBaseUrl(),
  timeout: parseInt(env.REACT_NATIVE_API_TIMEOUT || '30000', 10),
  retryAttempts: 3,
  retryDelay: 1000,
  // 429 is left out: retrying a rate-limited request only extends the limit.
  retryableStatusCodes: [408, 500, 502, 503, 504],
  tokenRefreshThreshold: 5 * 60 * 1000, // Refresh token if expires in < 5 min
  debugApiCalls: env.DEBUG_API_CALLS === 'true',
  logLevel: (env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
} as const;

// ─── API Endpoints ─────────────────────────────────────────────────────────

export const API_ENDPOINTS = {
  // Health
  health: '/health',

  // Auth
  auth: {
    sendOtp: '/auth/send-otp',
    verifyOtp: '/auth/verify-otp',
    firebaseLogin: '/auth/firebase-login',
    refreshToken: '/auth/refresh-token',
    logout: '/auth/logout',
    me: '/auth/me',
    submitKyc: '/auth/kyc',
    approveKyc: (userId: string) => `/auth/kyc/${userId}/approve`,
    rejectKyc: (userId: string) => `/auth/kyc/${userId}/reject`,
  },

  // Uploads
  uploads: {
    kyc: '/uploads/kyc',
  },

  // Users
  users: {
    me: '/users/me',
    savedRoutes: '/users/saved-routes',
    detail: (id: string) => `/users/${id}`,
    statement: '/users/me/statement',
    emailStatement: '/users/me/statement/email',
    verifiedStatus: '/users/me/verified-status',
    impact: '/users/me/impact',
    work: '/users/me/work',
    closure: '/users/me/closure',
    identity: '/users/me/identity',
    trackers: '/users/me/trackers',
    vehicleTracker: (vehicleId: string) => `/users/me/vehicles/${vehicleId}/tracker`,
  },

  // Rides
  rides: {
    myRides: '/rides/my-rides',
    search: '/rides/search',
    create: '/rides',
    detail: (id: string) => `/rides/${id}`,
    cancel: (id: string) => `/rides/${id}/cancel`,
    start: (id: string) => `/rides/${id}/start`,
    complete: (id: string) => `/rides/${id}/complete`,
    upcoming: '/rides/upcoming',
    updateLocation: '/rides/driver/location',
    /** Any phone on a ride in progress (background task): the trip trail */
    position: (id: string) => `/rides/${id}/position`,
    priceSuggestion: '/rides/price-suggestion',
    messageRiders: (id: string) => `/rides/${id}/message`,
  },

  // Bookings
  bookings: {
    create: '/bookings',
    quote: '/bookings/quote',
    riderBookings: '/bookings/as-rider',
    driverBookings: '/bookings/as-driver',
    confirm: (id: string) => `/bookings/${id}/confirm`,
    reject: (id: string) => `/bookings/${id}/reject`,
    cancel: (id: string) => `/bookings/${id}/cancel`,
    cancellationQuote: (id: string) => `/bookings/${id}/cancellation-quote`,
    complete: (id: string) => `/bookings/${id}/complete`,
    arrived: (id: string) => `/bookings/${id}/arrived`,
    pickedUp: (id: string) => `/bookings/${id}/picked-up`,
    inCar: (id: string) => `/bookings/${id}/in-car`,
    droppedOff: (id: string) => `/bookings/${id}/dropped-off`,
    noShow: (id: string) => `/bookings/${id}/no-show`,
    share: (id: string) => `/bookings/${id}/share`,
    receipt: (id: string) => `/bookings/${id}/receipt`,
    emailReceipt: (id: string) => `/bookings/${id}/receipt/email`,
  },

  // Ride alerts
  rideAlerts: {
    base: '/ride-alerts',
    one: (id: string) => `/ride-alerts/${id}`,
  },

  // Disputes
  parcels: {
    list: '/parcels',
    create: '/parcels/create',
    quote: '/parcels/quote',
    track: (trackingNumber: string) => `/parcels/track/${trackingNumber}`,
    cancel: (id: string) => `/parcels/${id}/cancel`,
    accept: (id: string) => `/parcels/${id}/accept`,
    reject: (id: string) => `/parcels/${id}/reject`,
    pickup: (id: string) => `/parcels/${id}/pickup`,
    deliver: (id: string) => `/parcels/${id}/deliver`,
    photos: (id: string) => `/parcels/${id}/photos`,
    claims: (id: string) => `/parcels/${id}/claims`,
  },
  trips: {
    base: '/trips',
    search: '/trips/search',
    mine: '/trips/mine',
    invite: (code: string) => `/trips/invite/${code}`,
    detail: (id: string) => `/trips/${id}`,
    join: (id: string) => `/trips/${id}/join`,
    respond: (id: string, requestId: string) => `/trips/${id}/requests/${requestId}`,
    leave: (id: string) => `/trips/${id}/leave`,
    payNumber: (id: string) => `/trips/${id}/pay-number`,
    expenses: (id: string) => `/trips/${id}/expenses`,
    expense: (id: string, expenseId: string) => `/trips/${id}/expenses/${expenseId}`,
    settlement: (id: string) => `/trips/${id}/settlement`,
    settle: (id: string) => `/trips/${id}/settlements`,
    notify: (id: string) => `/trips/${id}/settlement/notify`,
    activities: (id: string) => `/trips/${id}/activities`,
    vote: (id: string, activityId: string) => `/trips/${id}/activities/${activityId}/vote`,
    rateOrganizer: (id: string) => `/trips/${id}/rate-organizer`,
    calendarLink: (id: string) => `/trips/${id}/calendar-link`,
  },
  calls: {
    start: '/calls',
  },
  appeals: {
    base: '/appeals',
    mine: '/appeals/mine',
  },
  support: {
    tickets: '/support/tickets',
    ticket: (id: string) => `/support/tickets/${id}`,
    reply: (id: string) => `/support/tickets/${id}/reply`,
    assistant: '/support/assistant',
  },
  disputes: {
    create: '/disputes',
    mine: '/disputes/mine',
  },

  // Payments
  payments: {
    history: '/payments/history',
    options: '/payments/options',
    start: '/payments/start',
    charge: (reference: string) => `/payments/charges/${encodeURIComponent(reference)}`,
  },

  // Chat
  chat: {
    unreadCount: '/chat/unread-count',
    sendMessage: '/chat/messages',
    messages: (bookingId: string) => `/chat/${bookingId}/messages`,
    markBookingRead: (bookingId: string) => `/chat/${bookingId}/read`,
  },

  // Ratings
  ratings: {
    create: '/ratings',
    byUser: (userId: string) => `/ratings/user/${userId}`,
    pending: '/ratings/pending',
  },

  // Wallet
  wallet: {
    tiers: '/wallet/tiers', // public
    wallet: '/wallet',
    transactions: '/wallet/transactions',
    coinHistory: '/wallet/coins/history',
    topUp: '/wallet/topup',
    withdrawals: '/wallet/withdrawals',
    cancelWithdrawal: (id: string) => `/wallet/withdrawals/${id}/cancel`,
    convertCoins: '/wallet/coins/convert',
  },

  // Notifications
  notifications: {
    list: '/notifications',
    unreadCount: '/notifications/unread-count',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
  },

  // Maps
  maps: {
    autocomplete: '/maps/autocomplete',
    geocode: '/maps/geocode',
    reverseGeocode: '/maps/reverse-geocode',
    directions: '/maps/directions',
    distance: '/maps/distance',
    pickupToDrop: '/maps/pickup-to-drop',
    nearestDriver: '/maps/nearest-driver',
    trafficRoute: '/maps/traffic-route',
    geolocation: '/maps/geolocation',
    optimizeRoute: '/maps/optimize-route',
    navigation: '/maps/navigation',
    grounding: '/maps/grounding',
    nearby: '/maps/nearby',
    validateAddress: '/maps/validate-address',
  },

  // Safety
  safety: {
    activeIncidents: '/safety/sos/active', // admin
    triggerSos: '/safety/sos',
    currentSos: '/safety/sos/current',
    cancelSos: (id: string) => `/safety/sos/${id}/cancel`,
    sosStatus: (id: string) => `/safety/sos/${id}`,
    updateSosLocation: (id: string) => `/safety/sos/${id}/location`,
    addEvidence: (id: string) => `/safety/sos/${id}/evidence`,
    sosAudioUpload: (id: string) => `/safety/sos/${id}/audio-upload`,
    sosDetails: (id: string) => `/safety/sos/${id}/details`,
    sosVideo: (id: string) => `/safety/sos/${id}/video`,
    sosVideoSending: (id: string) => `/safety/sos/${id}/video/sending`,
    sosVideoStop: (id: string) => `/safety/sos/${id}/video/stop`,
    checkIn: (id: string) => `/safety/sos/${id}/check-in`,
    acknowledge: (id: string) => `/safety/sos/${id}/acknowledge`,
    resolve: (id: string) => `/safety/sos/${id}/resolve`,
    notifyPolice: (id: string) => `/safety/sos/${id}/notify-police`,
    emergencyContacts: '/safety/emergency-contacts',
    verifyEmergencyContact: (id: string) => `/safety/emergency-contacts/${id}/verify`,
    rideCheckIn: '/safety/ride-check-in',
  },

  // Admin
  admin: {
    metrics: '/admin/metrics',
    rides: '/admin/rides',
    users: '/admin/users',
    kycDocuments: (userId: string) => `/admin/kyc/${userId}/documents`,
    payments: '/admin/payments',
  },

  // Development ride simulator
  simulation: {
    status: '/dev/simulate',
    asRider: '/dev/simulate/as-rider',
    asDriver: '/dev/simulate/as-driver',
    drive: (rideId: string) => `/dev/simulate/rides/${rideId}/drive`,
    stop: (rideId: string) => `/dev/simulate/rides/${rideId}/stop`,
  },
} as const;

// ─── Response Status Codes ────────────────────────────────────────────────
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ─── Error Messages ───────────────────────────────────────────────────────
/** In the user's language (catalogue: errors.*), read when shown */
export const ERROR_MESSAGES = {
  get NETWORK_ERROR() { return i18n.t('errors.network'); },
  get TIMEOUT() { return i18n.t('errors.timeout'); },
  get UNAUTHORIZED() { return i18n.t('errors.unauthorized'); },
  get FORBIDDEN() { return i18n.t('errors.forbidden'); },
  get NOT_FOUND() { return i18n.t('errors.notFound'); },
  get VALIDATION_ERROR() { return i18n.t('errors.validation'); },
  get SERVER_ERROR() { return i18n.t('errors.server'); },
  get GENERIC_ERROR() { return i18n.t('errors.generic'); },
};

// ─── Token Storage Keys ────────────────────────────────────────────────────
export const TOKEN_STORAGE_KEYS = {
  accessToken: '@poolora_access_token',
  refreshToken: '@poolora_refresh_token',
  tokenExpiry: '@poolora_token_expiry',
  userId: '@poolora_user_id',
} as const;
