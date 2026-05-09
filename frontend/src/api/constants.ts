/**
 * api/constants.ts
 * 
 * API endpoints and configuration constants
 */

import { Platform } from 'react-native';

// ─── API Base URL Configuration ────────────────────────────────────────────
// Production backend is deployed at https://sanchari.me.
// Set REACT_NATIVE_API_BASE_URL in `.env` to override per environment.
const DEFAULT_BASE_URL = Platform.select({
  android: 'https://sanchari.me',
  ios: 'https://sanchari.me',
  web: 'https://sanchari.me',
  default: 'https://sanchari.me',
});

export const API_CONFIG = {
  baseUrl: process.env.REACT_NATIVE_API_BASE_URL || DEFAULT_BASE_URL,
  timeout: parseInt(process.env.REACT_NATIVE_API_TIMEOUT || '30000', 10),
  retryAttempts: 3,
  retryDelay: 1000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  tokenRefreshThreshold: 5 * 60 * 1000, // Refresh token if expires in < 5 min
  debugApiCalls: process.env.DEBUG_API_CALLS === 'true',
  logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
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
  },

  // Users
  users: {
    me: '/users/me',
    savedRoutes: '/users/saved-routes',
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
    updateSosLocation: (id: string) => `/safety/sos/${id}/location`,
    addEvidence: (id: string) => `/safety/sos/${id}/evidence`,
    acknowledge: (id: string) => `/safety/sos/${id}/acknowledge`,
    resolve: (id: string) => `/safety/sos/${id}/resolve`,
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
  accessToken: '@ridepool_access_token',
  refreshToken: '@ridepool_refresh_token',
  tokenExpiry: '@ridepool_token_expiry',
  userId: '@ridepool_user_id',
} as const;
