/**
 * hooks/useAsync.ts
 * 
 * Generic hook for async operations with loading, error, and data states
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface UseAsyncOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Hook for handling async operations with automatic state management
 *
 * @template T - Type of data being fetched
 * @param asyncFunction - Async function to execute
 * @param options - Configuration options
 * @returns State and refetch function
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useAsync(() => fetchUser());
 * ```
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  options?: UseAsyncOptions,
): AsyncState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const isMountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });

    try {
      const result = await asyncFunction();
      if (isMountedRef.current) {
        setState({ data: result, loading: false, error: null });
        options?.onSuccess?.(result);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (isMountedRef.current) {
        setState({ data: null, loading: false, error: err });
        options?.onError?.(err);
        logger.error('useAsync error', { error: err.message });
      }
    }
  }, [asyncFunction, options]);

  useEffect(() => {
    execute();

    return () => {
      isMountedRef.current = false;
    };
  }, [execute]);

  return {
    ...state,
    refetch: execute,
  };
}

// ─── Manual Execution Hook ────────────────────────────────────────────────

/**
 * Hook for executing async functions manually (not on mount)
 *
 * @template T - Type of data being returned
 * @param asyncFunction - Async function to execute
 * @param options - Configuration options
 * @returns State, execute function, and refetch
 *
 * @example
 * ```tsx
 * const { data, loading, error, execute } = useAsyncFn(() => createUser(data));
 * ```
 */
export function useAsyncFn<T>(
  asyncFunction: (...args: unknown[]) => Promise<T>,
  options?: UseAsyncOptions,
): AsyncState<T> & { execute: (...args: unknown[]) => Promise<T>; refetch: () => Promise<T> } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const isMountedRef = useRef(true);

  const execute = useCallback(
    async (...args: unknown[]) => {
      setState({ data: null, loading: true, error: null });

      try {
        const result = await asyncFunction(...args);
        if (isMountedRef.current) {
          setState({ data: result, loading: false, error: null });
          options?.onSuccess?.(result);
        }
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (isMountedRef.current) {
          setState({ data: null, loading: false, error: err });
          options?.onError?.(err);
          logger.error('useAsyncFn error', { error: err.message });
        }
        throw err;
      }
    },
    [asyncFunction, options],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    ...state,
    execute,
    refetch: () => execute(),
  };
}
