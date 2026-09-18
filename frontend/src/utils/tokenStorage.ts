/**
 * utils/tokenStorage.ts
 *
 * Token storage in the platform keychain/keystore via expo-secure-store.
 * Tokens are never written to unencrypted AsyncStorage on iOS or Android; if
 * secure storage fails the write fails and the user is asked to sign in again.
 * The web build has no secure store, so it uses AsyncStorage there.
 */

import { Platform } from 'react-native';
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

const isWeb = Platform.OS === 'web';

async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch (error) {
    logger.error('Failed to store token securely', { key, error });
    throw error;
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }

  try {
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;
  } catch (error) {
    logger.error('Failed to read token from secure storage', { key, error });
    return null;
  }

  // One-time migration: older builds could leave tokens in AsyncStorage.
  try {
    const legacy = await AsyncStorage.getItem(key);
    if (legacy === null) return null;
    await AsyncStorage.removeItem(key);
    await SecureStore.setItemAsync(key, legacy);
    return legacy;
  } catch {
    return null;
  }
}

async function secureRemove(key: string): Promise<void> {
  if (!isWeb) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      logger.debug('SecureStore remove failed', { key, error });
    }
  }
  try {
    // Also clears anything an older build left in AsyncStorage
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
    } catch (_error) {
      logger.error('Failed to save tokens', { error: _error });
      throw _error;
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
    } catch (_error) {
      logger.error('Failed to retrieve tokens', { error: _error });
      return null;
    }
  },

  /**
   * Get access token only
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await secureGet(TOKEN_STORAGE_KEYS.accessToken);
    } catch (_error) {
      logger.error('Failed to retrieve access token', { error: _error });
      return null;
    }
  },

  /**
   * Get refresh token only
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await secureGet(TOKEN_STORAGE_KEYS.refreshToken);
    } catch (_error) {
      logger.error('Failed to retrieve refresh token', { error: _error });
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
    } catch (_error) {
      logger.error('Failed to check token expiry', { error: _error });
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
    } catch (_error) {
      logger.error('Failed to clear tokens', { error: _error });
    }
  },

  /**
   * Save user ID
   */
  async saveUserId(userId: string): Promise<void> {
    try {
      await secureSet(TOKEN_STORAGE_KEYS.userId, userId);
    } catch (_error) {
      logger.error('Failed to save user ID', { error: _error });
    }
  },

  /**
   * Get stored user ID
   */
  async getUserId(): Promise<string | null> {
    try {
      return await secureGet(TOKEN_STORAGE_KEYS.userId);
    } catch (_error) {
      logger.error('Failed to retrieve user ID', { error: _error });
      return null;
    }
  },
};
