/**
 * services/userService.ts
 *
 * User profile operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, EarningsStatement, Impact, User, VerifiedStatus, WorkStatus } from '../types/api';

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
  async updateMyProfile(update: { name?: string; email?: string | null; dateOfBirth?: string; language?: string }): Promise<User> {
    try {
      const response = await apiClient.patch<ApiResponse<{ user: User }>>(API_ENDPOINTS.users.me, update);
      logger.info('User profile updated');
      return response.data.data.user;
    } catch (error) {
      logger.error('Failed to update user profile', { error });
      throw error;
    }
  },

  /** Sets the profile picture from a base64 JPEG or PNG; returns its link */
  async setPhoto(base64: string): Promise<string> {
    const response = await apiClient.put<ApiResponse<{ profilePhotoUrl: string }>>(API_ENDPOINTS.users.photo, { data: base64 }, { timeout: 60_000 });
    return response.data.data.profilePhotoUrl;
  },

  async removePhoto(): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.users.photo);
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

  /** The user's company programme (UC-C02) */
  async getWork(): Promise<WorkStatus> {
    const response = await apiClient.get<ApiResponse<WorkStatus>>(API_ENDPOINTS.users.work);
    return response.data.data;
  },

  /** Sends a confirmation link to a work email; they join when they confirm it */
  async joinWork(email: string): Promise<{ sentTo: string; company: string }> {
    const response = await apiClient.post<ApiResponse<{ sentTo: string; company: string }>>(API_ENDPOINTS.users.work, { email });
    return response.data.data;
  },

  /** Leaves the company programme */
  async leaveWork(): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.users.work);
  },

  /** CO₂ saved by the user's shared trips (UC-R11) */
  async getImpact(): Promise<Impact> {
    const response = await apiClient.get<ApiResponse<Impact>>(API_ENDPOINTS.users.impact);
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
