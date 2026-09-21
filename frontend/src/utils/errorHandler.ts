/**
 * utils/errorHandler.ts
 * 
 * Centralized error handling for API errors
 * Converts backend errors to user-friendly messages
 */

import axios, { AxiosError } from 'axios';
import { API_CONFIG, ERROR_MESSAGES, HTTP_STATUS } from '../api/constants';
import { logger } from './logger';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  status: string;
  code: number;
  error?: {
    id?: string;
    message?: string;
    details?: unknown;
  };
  timestamp?: string;
  requestId?: string;
}

export interface ProcessedError {
  message: string;
  code: number;
  isRetryable: boolean;
  originalError?: unknown;
  details?: unknown;
}

/**
 * The error API calls reject with (see setupErrorTransformInterceptor): a
 * real Error, so `error instanceof Error` and `error.message` work in screens,
 * carrying the status code and the backend's message.
 */
export class ApiError extends Error implements ProcessedError {
  code: number;
  isRetryable: boolean;
  originalError?: unknown;
  details?: unknown;

  constructor(processed: ProcessedError) {
    super(processed.message);
    this.name = 'ApiError';
    this.code = processed.code;
    this.isRetryable = processed.isRetryable;
    this.originalError = processed.originalError;
    this.details = processed.details;
  }
}

// ─── Error Handler ────────────────────────────────────────────────────────

class ErrorHandler {
  /**
   * Process an error and return user-friendly message
   */
  process(error: unknown): ProcessedError {
    logger.debug('Processing error', { error });

    if (error instanceof ApiError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      return this.handleAxiosError(error);
    }

    if (error instanceof Error) {
      return this.handleGenericError(error);
    }

    return {
      message: ERROR_MESSAGES.GENERIC_ERROR,
      code: 0,
      isRetryable: false,
      originalError: error,
    };
  }

  /**
   * Handle Axios errors (network, HTTP, etc.)
   */
  private handleAxiosError(error: AxiosError<ApiErrorResponse>): ProcessedError {
    const { response, code } = error;

    // Network error (no response from server)
    if (!response) {
      return {
        message: this.getNetworkErrorMessage(code),
        code: 0,
        isRetryable: true,
        originalError: error,
      };
    }

    // HTTP error response
    const status = response.status;
    const backendMessage = response.data?.error?.message;

    return {
      message: backendMessage || this.getHttpErrorMessage(status),
      code: status,
      isRetryable: this.isRetryable(status),
      originalError: error,
      details: response.data?.error?.details,
    };
  }

  /**
   * Handle generic JavaScript errors
   */
  private handleGenericError(error: Error): ProcessedError {
    return {
      message: error.message || ERROR_MESSAGES.GENERIC_ERROR,
      code: 0,
      isRetryable: false,
      originalError: error,
    };
  }

  /**
   * Get user-friendly message for network errors
   */
  private getNetworkErrorMessage(code?: string): string {
    switch (code) {
      case 'ECONNABORTED':
        return ERROR_MESSAGES.TIMEOUT;
      case 'ENOTFOUND':
      case 'ERR_NETWORK':
      case 'ECONNREFUSED':
        return ERROR_MESSAGES.NETWORK_ERROR;
      default:
        return ERROR_MESSAGES.NETWORK_ERROR;
    }
  }

  /**
   * Get user-friendly message for HTTP status codes
   */
  private getHttpErrorMessage(status: number): string {
    switch (status) {
      case HTTP_STATUS.BAD_REQUEST:
        return ERROR_MESSAGES.VALIDATION_ERROR;
      case HTTP_STATUS.UNAUTHORIZED:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case HTTP_STATUS.FORBIDDEN:
        return ERROR_MESSAGES.FORBIDDEN;
      case HTTP_STATUS.NOT_FOUND:
        return ERROR_MESSAGES.NOT_FOUND;
      case HTTP_STATUS.RATE_LIMIT:
        return 'Too many requests. Please wait a moment and try again.';
      case HTTP_STATUS.SERVER_ERROR:
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        return ERROR_MESSAGES.SERVER_ERROR;
      default:
        return ERROR_MESSAGES.GENERIC_ERROR;
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryable(status: number): boolean {
    return API_CONFIG.retryableStatusCodes.some((code) => code === status);
  }

  /**
   * Extract validation errors from response
   */
  getValidationErrors(error: unknown): Record<string, string> {
    if (!axios.isAxiosError(error)) return {};

    const response = error.response?.data as ApiErrorResponse;
    if (!response?.error?.details) return {};

    // Handle Joi validation errors format
    if (Array.isArray(response.error.details)) {
      const errors: Record<string, string> = {};
      response.error.details.forEach((err: any) => {
        if (err.field && err.message) {
          errors[err.field] = err.message;
        }
      });
      return errors;
    }

    // Handle object format
    return response.error.details as Record<string, string>;
  }
}

export const errorHandler = new ErrorHandler();