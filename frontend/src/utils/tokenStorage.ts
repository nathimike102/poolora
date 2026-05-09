/**
 * utils/tokenStorage.ts
 * 
 * Secure token storage using expo-secure-store
 * Falls back to AsyncStorage if secure store unavailable
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { logger } from './logger';
import { TOKEN_STORAGE_KEYS } from '../api/constants';

// ─── Types ────────────────────────────────────────────────────────────────
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

// ─── Token Storage Service ────────────────────────────────────────────────

/**
 * Tries to use SecureStore first, falls back to AsyncStorage
 */
async function secureSet(key: string, value: string): Promise<void> {
  try {
    // Try secure store first
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    logger.warn('SecureStore unavailable, falling back to AsyncStorage', { key, error });
    try {
      // Fallback to AsyncStorage
      await AsyncStorage.setItem(key, value);
    } catch (asyncError) {
      logger.error('Failed to store token', { key, error: asyncError });
      throw asyncError;
    }
  }
}

async function secureGet(key: string): Promise<string | null> {
  try {
    // Try secure store first
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;
  } catch (error) {
    logger.debug('SecureStore unavailable, trying AsyncStorage', { key });
  }

  try {
    // Fallback to AsyncStorage
    return await AsyncStorage.getItem(key);
  } catch (error) {
    logger.error('Failed to retrieve token', { key, error });
    return null;
  }
}

async function secureRemove(key: string): Promise<void> {
  try {
    // Try secure store first
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    logger.debug('SecureStore remove failed, trying AsyncStorage', { key });
  }

  try {
    // Also remove from AsyncStorage
    await AsyncStorage.removeItem(key);
  } catch (error) {
    logger.warn('Failed to remove token', { key, error });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export const tokenStorage = {
  /**
   * Save tokens to secure storage
   */
  async saveTokens(tokens: StoredTokens): Promise<void> {
    try {
      await Promise.all([
        secureSet(TOKEN_STORAGE_KEYS.accessToken, tokens.accessToken),
        secureSet(TOKEN_STORAGE_KEYS.refreshToken, tokens.refreshToken),
        tokens.expiresAt
          ? secureSet(TOKEN_STORAGE_KEYS.tokenExpiry, String(tokens.expiresAt))
          : Promise.resolve(),
      ]);
      logger.debug('Tokens saved successfully');
    } catch (error) {
      logger.error('Failed to save tokens', { error });
      throw error;
    }
  },

  /**
   * Retrieve tokens from secure storage
   */
  async getTokens(): Promise<StoredTokens | null> {
    try {
      const [accessToken, refreshToken, expiryStr] = await Promise.all([
        secureGet(TOKEN_STORAGE_KEYS.accessToken),
        secureGet(TOKEN_STORAGE_KEYS.refreshToken),
        secureGet(TOKEN_STORAGE_KEYS.tokenExpiry),
      ]);

      if (!accessToken || !refreshToken) {
        return null;
      }

      return {
        accessToken,
        refreshToken,
        expiresAt: expiryStr ? parseInt(expiryStr, 10) : undefined,
      };
    } catch (error) {
      logger.error('Failed to retrieve tokens', { error });
      return null;
    }
  },

  /**
   * Get access token only
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await secureGet(TOKEN_STORAGE_KEYS.accessToken);
    } catch (error) {
      logger.error('Failed to retrieve access token', { error });
      return null;
    }
  },

  /**
   * Get refresh token only
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await secureGet(TOKEN_STORAGE_KEYS.refreshToken);
    } catch (error) {
      logger.error('Failed to retrieve refresh token', { error });
      return null;
    }
  },

  /**
   * Check if token is expired
   */
  async isTokenExpired(): Promise<boolean> {
    try {
      const expiryStr = await secureGet(TOKEN_STORAGE_KEYS.tokenExpiry);
      if (!expiryStr) return false;

      const expiresAt = parseInt(expiryStr, 10);
      return Date.now() >= expiresAt;
    } catch (error) {
      logger.error('Failed to check token expiry', { error });
      return true; // Assume expired on error
    }
  },

  /**
   * Clear all stored tokens
   */
  async clearTokens(): Promise<void> {
    try {
      await Promise.all([
        secureRemove(TOKEN_STORAGE_KEYS.accessToken),
        secureRemove(TOKEN_STORAGE_KEYS.refreshToken),
        secureRemove(TOKEN_STORAGE_KEYS.tokenExpiry),
        secureRemove(TOKEN_STORAGE_KEYS.userId),
      ]);
      logger.debug('Tokens cleared successfully');
    } catch (error) {
      logger.error('Failed to clear tokens', { error });
    }
  },

  /**
   * Save user ID
   */
  async saveUserId(userId: string): Promise<void> {
    try {
      await secureSet(TOKEN_STORAGE_KEYS.userId, userId);
    } catch (error) {
      logger.error('Failed to save user ID', { error });
    }
  },

  /**
   * Get stored user ID
   */
  async getUserId(): Promise<string | null> {
    try {
      return await secureGet(TOKEN_STORAGE_KEYS.userId);
    } catch (error) {
      logger.error('Failed to retrieve user ID', { error });
      return null;
    }
  },
};
