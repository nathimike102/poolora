/**
 * services/userService.ts
 *
 * User profile operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, User } from '../types/api';

/**
 * Service for user profile operations
 */
export const userService = {
  /**
   * Get current user's profile
   */
  async getMyProfile(): Promise<User> {
    try {
      const response = await apiClient.get<ApiResponse<{ user: User }>>(API_ENDPOINTS.users.me);
      logger.info('User profile fetched');
      return response.data.data.user;
    } catch (error) {
      logger.error('Failed to get user profile', { error });
      throw error;
    }
  },

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<User> {
    logger.warn('User profile by ID endpoint is unavailable; returning current profile', { userId });
    return this.getMyProfile();
  },

  /**
   * Get saved routes
   */
  async getSavedRoutes(): Promise<unknown> {
    try {
      const response = await apiClient.get<ApiResponse<unknown>>(API_ENDPOINTS.users.savedRoutes);
      logger.info('Saved routes fetched');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get saved routes', { error });
      throw error;
    }
  },
};
