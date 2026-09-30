/**
 * services/userService.ts
 *
 * User profile operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, EarningsStatement, User, VerifiedStatus } from '../types/api';

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
   * Update the signed-in user's name, email and date of birth
   */
  async updateMyProfile(update: { name?: string; email?: string | null; dateOfBirth?: string }): Promise<User> {
    try {
      const response = await apiClient.patch<ApiResponse<{ user: User }>>(API_ENDPOINTS.users.me, update);
      logger.info('User profile updated');
      return response.data.data.user;
    } catch (error) {
      logger.error('Failed to update user profile', { error });
      throw error;
    }
  },

  /** Whether the account can be closed now, and what is in the way if not */
  async getClosureCheck(): Promise<{ canClose: boolean; blockers: string[]; walletBalance: number; coins: number; coinsValue: number }> {
    const response = await apiClient.get<ApiResponse<{ canClose: boolean; blockers: string[]; walletBalance: number; coins: number; coinsValue: number }>>(API_ENDPOINTS.users.closure);
    return response.data.data;
  },

  /** Closes the account for good and removes the personal data */
  async closeAccount(reason?: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.users.me, { data: { confirm: true, ...(reason ? { reason } : {}) } });
    logger.info('Account closed');
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

  /** A month's earnings, line by line; month looks like 2026-09 (UC-D09) */
  async getStatement(month: string): Promise<EarningsStatement> {
    const response = await apiClient.get<ApiResponse<EarningsStatement>>(API_ENDPOINTS.users.statement, { params: { month } });
    return response.data.data;
  },

  /** The same statement as a CSV spreadsheet */
  async getStatementCsv(month: string): Promise<string> {
    const response = await apiClient.get<string>(API_ENDPOINTS.users.statement, {
      params: { month, format: 'csv' },
      responseType: 'text',
      transformResponse: r => r,
    });
    return response.data;
  },

  /** Emails the statement to the address on the profile; returns that address */
  async emailStatement(month: string): Promise<{ to: string }> {
    const response = await apiClient.post<ApiResponse<{ to: string }>>(API_ENDPOINTS.users.emailStatement, { month });
    return response.data.data;
  },

  /** Progress towards the Verified Driver badge (UC-D10) */
  async getVerifiedStatus(): Promise<VerifiedStatus> {
    const response = await apiClient.get<ApiResponse<VerifiedStatus>>(API_ENDPOINTS.users.verifiedStatus);
    return response.data.data;
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
