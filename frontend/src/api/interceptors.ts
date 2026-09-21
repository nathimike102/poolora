/**
 * api/interceptors.ts
 * 
 * Advanced interceptors for:
 * - Token refresh on 401
 * - Retry logic for transient errors
 * - Request/response transformation
 */

import { AxiosError } from 'axios';
import { apiClient } from './axios';
import { API_CONFIG, HTTP_STATUS } from './constants';
import { ApiError, errorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { refreshAccessToken } from '../services/authService';

// ─── Types ─────────────────────────────────────────────────────────────────

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Retries already made for this request (set by the retry interceptor). */
    retryCount?: number;
    /** Never retry this request, e.g. search-as-you-type lookups. */
    noRetry?: boolean;
  }
}

// ─── Global State ──────────────────────────────────────────────────────────

let isRefreshingToken = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (token: string | null, error?: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ─── Auth Interceptor ──────────────────────────────────────────────────────

// A 401 from these means bad credentials, not an expired session, so a token
// refresh would be wrong (and a failed refresh would log the user out).
const NO_REFRESH_PATHS = [
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/firebase-login',
  '/auth/refresh-token',
  '/auth/logout',
];

/**
 * Setup auth interceptor that:
 * 1. Handles 401 errors
 * 2. Attempts token refresh
 * 3. Retries original request
 * 4. Redirects to login if refresh fails
 */
export function setupAuthInterceptor(): void {
  apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const { response, config } = error;

      // Only handle 401 errors from requests made with a session
      if (response?.status !== HTTP_STATUS.UNAUTHORIZED) {
        return Promise.reject(error);
      }
      if (NO_REFRESH_PATHS.some((path) => config?.url?.includes(path))) {
        return Promise.reject(error);
      }

      logger.warn('Unauthorized (401) - attempting token refresh', { url: config?.url });

      // Prevent multiple token refresh attempts
      if (!isRefreshingToken) {
        isRefreshingToken = true;

        try {
          const newToken = await refreshAccessToken();
          isRefreshingToken = false;
          processQueue(newToken);

          // Retry original request with new token
          if (config && newToken) {
            config.headers.Authorization = `Bearer ${newToken}`;
            return apiClient.request(config);
          }
          } catch (err) {
          isRefreshingToken = false;
            processQueue(null, err as unknown);
          return Promise.reject(err);
        }
      }

      // Queue request while token is being refreshed
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            if (config) {
              config.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient.request(config));
            }
          },
          reject: (error: unknown) => reject(error),
        });
      });
    },
  );
}

// ─── Retry Interceptor ─────────────────────────────────────────────────────

/**
 * Setup retry interceptor that retries failed requests with exponential backoff
 */
export function setupRetryInterceptor(): void {
  apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const { response, config } = error;

      if (!config || !response || config.noRetry) {
        return Promise.reject(error);
      }

      // Only retry requests that are safe to repeat. Retrying a POST could
      // create a second booking, payment order or SOS alert.
      const method = (config.method ?? 'get').toLowerCase();
      if (!['get', 'head', 'options', 'put', 'delete'].includes(method)) {
        return Promise.reject(error);
      }

      // Skip retry for certain status codes
      if (
        response.status === HTTP_STATUS.UNAUTHORIZED ||
        response.status === HTTP_STATUS.FORBIDDEN ||
        response.status === HTTP_STATUS.NOT_FOUND ||
        response.status === HTTP_STATUS.BAD_REQUEST ||
        response.status === HTTP_STATUS.UNPROCESSABLE_ENTITY
      ) {
        return Promise.reject(error);
      }

      // Kept on the config itself: apiClient.request() below builds a new
      // config object, so anything keyed on the old one would reset to zero
      // and the request would be retried forever.
      const retryCount = config.retryCount ?? 0;

      // Check if we should retry
      if (!API_CONFIG.retryableStatusCodes.some((code) => code === response.status)) {
        return Promise.reject(error);
      }

      if (retryCount >= API_CONFIG.retryAttempts) {
        logger.warn('Max retries exceeded', {
          url: config.url,
          status: response.status,
          retries: retryCount,
        });
        return Promise.reject(error);
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        API_CONFIG.retryDelay * Math.pow(2, retryCount),
        30000, // Max 30 seconds
      );

      logger.info('Retrying request', {
        url: config.url,
        attempt: retryCount + 1,
        maxAttempts: API_CONFIG.retryAttempts,
        delay,
      });

      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient.request({ ...config, retryCount: retryCount + 1 });
    },
  );
}

// ─── Error Transformation Interceptor ──────────────────────────────────────

/**
 * Transform errors to standardized format
 */
export function setupErrorTransformInterceptor(): void {
  apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      return Promise.reject(new ApiError(errorHandler.process(error)));
    },
  );
}

// ─── Initialize All Interceptors ───────────────────────────────────────────

export function setupAllInterceptors(): void {
  // Response interceptors run in the order they are added. Retry and token
  // refresh need the raw AxiosError (status, config), so the transform that
  // replaces it with an ApiError must come last.
  setupRetryInterceptor();
  setupAuthInterceptor();
  setupErrorTransformInterceptor();
  logger.info('All API interceptors initialized');
}
