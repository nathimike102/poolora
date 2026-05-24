/**
 * services/paymentService.ts
 *
 * Payment operations API integration
 * Handles Razorpay payments and wallet transactions
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, Payment, PaginatedResponse } from '../types/api';

/**
 * Service for payment operations
 */
export const paymentService = {
  /**
   * Get payment history for the authenticated user.
   */
  async getPaymentHistory(
    role: 'rider' | 'driver' = 'rider',
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Payment>> {
    try {
      const query = new URLSearchParams({
        role,
        page: String(page),
        limit: String(limit),
      });
      const response = await apiClient.get<PaginatedResponse<Payment>>(
        `${API_ENDPOINTS.payments.history}?${query.toString()}`,
      );
      logger.info('Payment history fetched', { role, page, limit });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch payment history', { error, role, page, limit });
      throw error;
    }
  },
};
