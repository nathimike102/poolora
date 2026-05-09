/**
 * services/notificationService.ts
 *
 * Notification operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, Notification, PaginatedResponse, PaginatedResult } from '../types/api';

/**
 * Service for notification operations
 */
export const notificationService = {
  /**
   * Get all notifications
   */
  async getNotifications(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Notification>> {
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const response = await apiClient.get<ApiResponse<PaginatedResult<Notification>>>(
        `${API_ENDPOINTS.notifications.list}?${queryParams.toString()}`,
      );
      logger.info('Notifications fetched', { count: response.data.data.items?.length || 0 });
      return response.data;
    } catch (error) {
      logger.error('Failed to get notifications', { error });
      throw error;
    }
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      const response = await apiClient.patch<ApiResponse<Notification>>(
        API_ENDPOINTS.notifications.markRead(notificationId),
        {},
      );
      logger.info('Notification marked as read');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to mark notification as read', { error });
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.patch(API_ENDPOINTS.notifications.markAllRead, {});
      logger.info('All notifications marked as read');
    } catch (error) {
      logger.error('Failed to mark all notifications as read', { error });
      throw error;
    }
  },
};
