/**
 * hooks/useApi.ts
 * 
 * Hook for making API calls with automatic error handling and state management
 */

import { useCallback } from 'react';
import { AxiosError } from 'axios';
import { useAsyncFn, AsyncState } from './useAsync';
import { errorHandler, ProcessedError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: ProcessedError) => void;
}

export interface UseApiState<T> extends AsyncState<T> {
  execute: (...args: any[]) => Promise<T>;
  refetch: () => Promise<T>;
  errorMessage: string | null;
  isRetryable: boolean;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Hook for making API calls with error handling
 *
 * @template T - Type of API response data
 * @param apiFunction - Function that makes the API call
 * @param options - Configuration options
 * @returns State object with execute function
 *
 * @example
 * ```tsx
 * const { data, loading, error, execute } = useApi(
 *   () => rideService.searchRides(params),
 *   { onSuccess: (rides) => console.log(rides) }
 * );
 * ```
 */
export function useApi<T>(
  apiFunction: (...args: any[]) => Promise<T>,
  options?: UseApiOptions,
): UseApiState<T> {
  const { data, loading, error, execute: executeAsync, refetch } = useAsyncFn(apiFunction, {
    onSuccess: options?.onSuccess,
    onError: (error) => {
      // Error is already logged, just notify callback
      const processed = errorHandler.process(error);
      options?.onError?.(processed);
    },
  });

  // Parse error details
  let errorMessage: string | null = null;
  let isRetryable = false;

  if (error) {
    const processed = errorHandler.process(error);
    errorMessage = processed.message;
    isRetryable = processed.isRetryable;
  }

  const execute = useCallback(
    async (...args: any[]) => {
      try {
        return await executeAsync(...args);
      } catch (err) {
        // Error already handled in executeAsync
        throw err;
      }
    },
    [executeAsync],
  );

  return {
    data,
    loading,
    error,
    errorMessage,
    isRetryable,
    execute,
    refetch: () => execute(),
  };
}

/**
 * Hook for GET API calls
 */
export function useApiGet<T>(
  apiFunction: () => Promise<T>,
  options?: UseApiOptions,
): UseApiState<T> {
  return useApi(apiFunction, options);
}

/**
 * Hook for POST/PUT/DELETE API calls (manual execution)
 */
export function useApiMutation<T>(
  apiFunction: (...args: any[]) => Promise<T>,
  options?: UseApiOptions,
): UseApiState<T> {
  const state = useApi(apiFunction, options);
  // Override to not execute on mount
  return {
    ...state,
    loading: false,
    data: null,
  };
}
