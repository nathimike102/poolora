/**
 * services/chatService.ts
 *
 * Chat operations API integration
 * Handles messaging and conversations
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, Message, PaginatedResponse, SendMessageRequest } from '../types/api';

/**
 * Service for chat operations
 */
export const chatService = {
  /**
   * Get total unread message count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await apiClient.get<ApiResponse<{ unreadCount: number }>>(API_ENDPOINTS.chat.unreadCount);
      return response.data.data.unreadCount;
    } catch (error) {
      logger.error('Failed to get unread count', { error });
      throw error;
    }
  },

  /**
   * Get messages for a booking chat (paginated)
   */
  async getMessages(
    bookingId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResponse<Message>> {
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const response = await apiClient.get<PaginatedResponse<Message>>(
        `${API_ENDPOINTS.chat.messages(bookingId)}?${queryParams.toString()}`,
      );
      logger.info('Messages fetched', { bookingId, count: response.data.data.items?.length || 0 });
      return response.data;
    } catch (error) {
      logger.error('Failed to get messages', { error, bookingId });
      throw error;
    }
  },

  /**
   * Send a message
   */
  async sendMessage(bookingId: string, content: string, clientMsgId?: string): Promise<Message> {
    try {
      const payload: SendMessageRequest & { clientMsgId?: string } = { 
        bookingId, 
        content, 
        contentType: 'text',
        clientMsgId 
      };
      const response = await apiClient.post<ApiResponse<{ message: Message }>>(
        API_ENDPOINTS.chat.sendMessage,
        payload,
      );
      logger.info('Message sent', { bookingId, clientMsgId });
      return response.data.data.message;
    } catch (error) {
      logger.error('Failed to send message', { error, bookingId, clientMsgId });
      throw error;
    }
  },

  /**
   * Mark a booking chat as read
   */
  async markBookingAsRead(bookingId: string): Promise<number> {
    try {
      const response = await apiClient.post<ApiResponse<{ markedRead: number }>>(
        API_ENDPOINTS.chat.markBookingRead(bookingId),
        {},
      );
      return response.data.data.markedRead;
    } catch (error) {
      logger.error('Failed to mark booking as read', { error, bookingId });
      throw error;
    }
  },
};
