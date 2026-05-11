/**
 * api/axios.ts
 * 
 * Axios client instance with centralized configuration
 */

import axios, { AxiosInstance } from 'axios';
import { API_CONFIG } from './constants';
import { logger } from '../utils/logger';

// ─── Axios Instance ────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // Cookies are relevant for web; on React Native this is typically ignored.
  // Keeping enabled lets us support the backend's optional cookie auth too.
  withCredentials: true,
});

// ─── Request Interceptor ───────────────────────────────────────────────────

/**
 * Intercepts all outgoing requests to:
 * - Add authorization token
 * - Add request ID for tracking
 * - Log requests in debug mode
 */
apiClient.interceptors.request.use(
  async (config) => {
    // Generate unique request ID
    const requestId = generateRequestId();
    config.headers['X-Request-ID'] = requestId;

    if (API_CONFIG.debugApiCalls) {
      logger.debug('API Request', {
        method: config.method?.toUpperCase(),
        url: config.url,
        requestId,
      });
    }

    return config;
  },
  (error) => {
    logger.error('Request interceptor error', error);
    return Promise.reject(error);
  },
);

// ─── Response Logger (no data unwrapping) ──────────────────────────────────
// IMPORTANT: Do not unwrap response.data here. Many services rely on Axios'
// standard response shape (`{ data, status, headers, ... }`) and TypeScript
// typing breaks if we return `response.data.data` from the interceptor.
apiClient.interceptors.response.use(
  (response) => {
    if (API_CONFIG.debugApiCalls) {
      logger.debug('API Response', {
        status: response.status,
        url: response.config.url,
        requestId: response.config.headers['X-Request-ID'],
      });
    }
    return response;
  },
  (error) => {
    if (API_CONFIG.debugApiCalls) {
      logger.debug('API Error Response', {
        status: error.response?.status,
        url: error.config?.url,
        requestId: error.config?.headers?.['X-Request-ID'],
      });
    }
    return Promise.reject(error);
  },
);

// ─── Utility Functions ─────────────────────────────────────────────────────

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Set authorization header with token
 */
export function setAuthorizationHeader(token: string): void {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  logger.debug('Authorization header set');
}

/**
 * Remove authorization header
 */
export function clearAuthorizationHeader(): void {
  delete apiClient.defaults.headers.common['Authorization'];
  logger.debug('Authorization header cleared');
}

/**
 * Get current authorization header value
 */
export function getAuthorizationHeader(): string | undefined {
  return apiClient.defaults.headers.common['Authorization'] as string | undefined;
}

export default apiClient;
