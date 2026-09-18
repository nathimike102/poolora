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
   * Update the signed-in user's name and email
   */
  async updateMyProfile(update: { name?: string; email?: string | null }): Promise<User> {
    try {
      const response = await apiClient.patch<ApiResponse<{ user: User }>>(API_ENDPOINTS.users.me, update);
      logger.info('User profile updated');
      return response.data.data.user;
    } catch (error) {
      logger.error('Failed to update user profile', { error });
      throw error;
    }
  },

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<User> {
    try {
      const response = await apiClient.get<ApiResponse<{ user: User }>>(API_ENDPOINTS.users.detail(userId));
      return response.data.data.user;
    } catch (error) {
      logger.error('Failed to get user profile', { error, userId });
      throw error;
    }
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
