/**
 * services/paymentService.ts
 *
 * Online payments through Paynow (EcoCash, OneMoney, InnBucks, card) and
 * payment history
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, Charge, Payment, PaginatedResponse, PaymentOptions, PayChannel, PayCurrency } from '../types/api';

/**
 * Service for payment operations
 */
export const paymentService = {
  /** Which currencies can be paid in right now, and the ZiG rate */
  async options(): Promise<PaymentOptions> {
    const response = await apiClient.get<ApiResponse<PaymentOptions>>(API_ENDPOINTS.payments.options);
    return response.data.data;
  },

  /** Starts paying for a booking or parcel; follow it with status() */
  async start(input: { purpose: 'booking' | 'parcel'; targetId: string; channel: PayChannel; phone?: string; currency: PayCurrency }): Promise<Charge> {
    const response = await apiClient.post<ApiResponse<{ charge: Charge }>>(API_ENDPOINTS.payments.start, input);
    return response.data.data.charge;
  },

  /** Starts a wallet top-up; follow it with status() */
  async topUp(input: { amount: number; channel: PayChannel; phone?: string; currency: PayCurrency }): Promise<Charge> {
    const response = await apiClient.post<ApiResponse<{ charge: Charge }>>(API_ENDPOINTS.wallet.topUp, input);
    return response.data.data.charge;
  },

  /** Where a payment stands; the backend asks Paynow when it is still pending */
  async status(reference: string): Promise<Charge> {
    const response = await apiClient.get<ApiResponse<{ charge: Charge }>>(API_ENDPOINTS.payments.charge(reference));
    return response.data.data.charge;
  },

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
