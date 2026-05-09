/**
 * services/ratingService.ts
 *
 * Rating operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, Rating } from '../types/api';

/**
 * Service for rating operations
 */
export const ratingService = {
  /**
   * Submit a rating for a completed booking.
   */
  async submitRating(
    bookingId: string,
    score: number,
    comment?: string,
    tags: string[] = [],
  ): Promise<Rating> {
    try {
      const response = await apiClient.post<ApiResponse<{ rating: Rating }>>(API_ENDPOINTS.ratings.create, {
        bookingId,
        score,
        comment,
        tags,
      });
      logger.info('Rating submitted', { bookingId, score });
      return response.data.data.rating;
    } catch (error) {
      logger.error('Failed to submit rating', { error, bookingId });
      throw error;
    }
  },

  /**
   * Get ratings for a user.
   */
  async getUserRatings(userId: string, page: number = 1, limit: number = 20): Promise<Rating[]> {
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(limit) });
      const response = await apiClient.get<ApiResponse<{ ratings: Rating[] }>>(
        `${API_ENDPOINTS.ratings.byUser(userId)}?${query.toString()}`,
      );
      return response.data.data.ratings;
    } catch (error) {
      logger.error('Failed to get user ratings', { error, userId });
      throw error;
    }
  },
};
