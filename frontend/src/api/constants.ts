/**
 * api/constants.ts
 * 
 * API endpoints and configuration constants
 */

import { env } from '../config/env';


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
  },

  // Rides
  rides: {
    myRides: '/rides/my-rides',
    search: '/rides/search',
    create: '/rides',
    detail: (id: string) => `/rides/${id}`,
    cancel: (id: string) => `/rides/${id}/cancel`,
    complete: (id: string) => `/rides/${id}/complete`,
    upcoming: '/rides/upcoming',
    updateLocation: '/rides/driver/location',
  },

  // Bookings
  bookings: {
    create: '/bookings',
    riderBookings: '/bookings/as-rider',
    driverBookings: '/bookings/as-driver',
    confirm: (id: string) => `/bookings/${id}/confirm`,
    reject: (id: string) => `/bookings/${id}/reject`,
    cancel: (id: string) => `/bookings/${id}/cancel`,
    complete: (id: string) => `/bookings/${id}/complete`,
  },

  // Payments
  payments: {
    history: '/payments/history',
    webhook: '/payments/webhook', // server-to-server only
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
  },

  // Wallet
  wallet: {
    tiers: '/wallet/tiers', // public
    wallet: '/wallet',
    transactions: '/wallet/transactions',
    coinHistory: '/wallet/coins/history',
    topUp: '/wallet/topup',
    confirmTopUp: '/wallet/topup/confirm',
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
    sosStatus: (id: string) => `/safety/sos/${id}`,
    updateSosLocation: (id: string) => `/safety/sos/${id}/location`,
    addEvidence: (id: string) => `/safety/sos/${id}/evidence`,
    checkIn: (id: string) => `/safety/sos/${id}/check-in`,
    acknowledge: (id: string) => `/safety/sos/${id}/acknowledge`,
    resolve: (id: string) => `/safety/sos/${id}/resolve`,
    notifyPolice: (id: string) => `/safety/sos/${id}/notify-police`,
    emergencyContacts: '/safety/emergency-contacts',
  },

  // Admin
  admin: {
    metrics: '/admin/metrics',
    rides: '/admin/rides',
    users: '/admin/users',
    kycDocuments: (userId: string) => `/admin/kyc/${userId}/documents`,
    payments: '/admin/payments',
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
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
} as const;

// ─── Token Storage Keys ────────────────────────────────────────────────────
export const TOKEN_STORAGE_KEYS = {
  accessToken: '@poolora_access_token',
  refreshToken: '@poolora_refresh_token',
  tokenExpiry: '@poolora_token_expiry',
  userId: '@poolora_user_id',
} as const;
