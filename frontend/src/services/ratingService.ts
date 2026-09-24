/**
 * services/ratingService.ts
 *
 * Rating operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, Rating } from '../types/api';

export type RatingCategory = 'behavior' | 'cleanliness' | 'punctuality';
export type RatingIssue = 'safety' | 'route' | 'payment';

/** What the rider fills in (UC-R06) */
export interface RatingInput {
  score: number;
  categories?: Partial<Record<RatingCategory, number>>;
  tags?: string[];
  comment?: string;
  issues?: RatingIssue[];
  issueDetails?: string;
}

export interface RatingSummary {
  count: number;
  overall: number | null;
  categories: Record<RatingCategory, number | null>;
}

/** A finished trip that can still be rated, from GET /ratings/pending */
export interface PendingRating {
  bookingId: string;
  role: 'rider' | 'driver';
  rateeName: string;
  from?: string;
  to?: string;
  completedAt: string;
  closesAt: string;
}

/**
 * Service for rating operations
 */
export const ratingService = {
  /**
   * Submit a rating for a completed booking.
   */
  async submitRating(bookingId: string, input: RatingInput): Promise<Rating> {
    const { score } = input;
    try {
      const response = await apiClient.post<ApiResponse<{ rating: Rating }>>(API_ENDPOINTS.ratings.create, {
        bookingId,
        score,
        comment: input.comment?.trim() || undefined,
        tags: input.tags ?? [],
        categories: input.categories && Object.keys(input.categories).length ? input.categories : undefined,
        issues: input.issues ?? [],
        issueDetails: input.issueDetails?.trim() || undefined,
      });
      logger.info('Rating submitted', { bookingId, score });
      return response.data.data.rating;
    } catch (error) {
      logger.error('Failed to submit rating', { error, bookingId });
      throw error;
    }
  },

  /** Average overall and category scores a user received as a driver or rider */
  async getSummary(userId: string, as: 'driver' | 'rider' = 'driver'): Promise<RatingSummary> {
    const response = await apiClient.get<ApiResponse<RatingSummary>>(`${API_ENDPOINTS.ratings.byUser(userId)}/summary?as=${as}`);
    return response.data.data;
  },

  /** Trips the user finished in the last 7 days and has not rated */
  async getPending(): Promise<PendingRating[]> {
    const response = await apiClient.get<ApiResponse<{ trips: PendingRating[] }>>(API_ENDPOINTS.ratings.pending);
    return response.data.data.trips;
  },

  /**
   * Get ratings for a user.
   */
  async getUserRatings(
    userId: string,
    page: number = 1,
    limit: number = 20,
    /** Only ratings received as a driver (from riders) or as a rider (from drivers) */
    as?: 'driver' | 'rider',
  ): Promise<Rating[]> {
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (as) query.set('as', as);
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
