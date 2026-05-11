/**
 * api/interceptors.ts
 * 
 * Advanced interceptors for:
 * - Token refresh on 401
 * - Retry logic for transient errors
 * - Request/response transformation
 */

import { AxiosError } from 'axios';
import { apiClient, setAuthorizationHeader, clearAuthorizationHeader } from './axios';
import { API_CONFIG, HTTP_STATUS } from './constants';
import { tokenStorage } from '../utils/tokenStorage';
import { errorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import type { ApiResponse, RefreshTokenResponse } from '../types/api';
import { getJwtExpiresAtMs } from '../utils/jwt';

// ─── Types ─────────────────────────────────────────────────────────────────

interface RetryRequest {
  config: unknown;
  count: number;
  delay: number;
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

      // Only handle 401 errors
      if (response?.status !== HTTP_STATUS.UNAUTHORIZED) {
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
  const retryMap = new WeakMap<object, RetryRequest>();

  apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const { response, config } = error;

      if (!config || !response) {
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

      // Get retry count from map
      const retry = retryMap.get(config);
      const retryCount = retry?.count ?? 0;

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

      // Update retry count
      retryMap.set(config, { config, count: retryCount + 1, delay });

      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient.request(config);
    },
  );
}

// ─── Token Refresh ─────────────────────────────────────────────────────────

/**
 * Attempt to refresh the access token using refresh token
 */
async function refreshAccessToken(): Promise<string> {
  try {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // Temporarily remove auth header to avoid loops
    clearAuthorizationHeader();

    // Call refresh endpoint
    const response = await apiClient.post<ApiResponse<RefreshTokenResponse>>('/auth/refresh-token', {
      refreshToken,
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
    if (accessToken) {
      // Store new token
      await tokenStorage.saveTokens({
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: getJwtExpiresAtMs(accessToken) ?? undefined,
      });

      // Set new token
      setAuthorizationHeader(accessToken);
      logger.info('Token refreshed successfully');
      return accessToken;
    }

    throw new Error('No access token in refresh response');
  } catch (error) {
    logger.error('Token refresh failed', error);
    // Clear tokens on refresh failure
    await tokenStorage.clearTokens();
    clearAuthorizationHeader();
    // Redirect to login should be handled by calling code
    throw error;
  }
}

// ─── Error Transformation Interceptor ──────────────────────────────────────

/**
 * Transform errors to standardized format
 */
export function setupErrorTransformInterceptor(): void {
  apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const processedError = errorHandler.process(error);
      return Promise.reject(processedError);
    },
  );
}

// ─── Initialize All Interceptors ───────────────────────────────────────────

export function setupAllInterceptors(): void {
  setupErrorTransformInterceptor();
  setupRetryInterceptor();
  setupAuthInterceptor();
  logger.info('All API interceptors initialized');
}
