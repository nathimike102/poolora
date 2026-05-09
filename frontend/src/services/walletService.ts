/**
 * services/walletService.ts
 *
 * Wallet and transaction operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, Wallet, Transaction, PaginatedResponse, PaginatedResult } from '../types/api';

/**
 * Service for wallet operations
 */
export const walletService = {
  /**
   * Get wallet balance
   */
  async getBalance(): Promise<Wallet> {
    try {
      const response = await apiClient.get<ApiResponse<Wallet>>(API_ENDPOINTS.wallet.wallet);
      logger.info('Wallet balance fetched', { balance: response.data.data.balance });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get wallet balance', { error });
      throw error;
    }
  },

  /**
   * Get wallet transactions
   */
  async getTransactions(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Transaction>> {
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const response = await apiClient.get<ApiResponse<PaginatedResult<Transaction>>>(
        `${API_ENDPOINTS.wallet.transactions}?${queryParams.toString()}`,
      );
      logger.info('Transactions fetched', { count: response.data.data.items?.length || 0 });
      return response.data;
    } catch (error) {
      logger.error('Failed to get transactions', { error });
      throw error;
    }
  },

  /**
   * Top up wallet
   */
  async topUp(amount: number): Promise<any> {
    try {
      const response = await apiClient.post<ApiResponse<any>>(API_ENDPOINTS.wallet.topUp, { amount });
      logger.info('Wallet topped up', { amount });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to top up wallet', { error, amount });
      throw error;
    }
  },

  /**
   * Convert coins to cash
   */
  async convertCoins(coins: number): Promise<any> {
    try {
      const response = await apiClient.post<ApiResponse<any>>(API_ENDPOINTS.wallet.convertCoins, { coins });
      logger.info('Coins converted', { coins });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to convert coins', { error, coins });
      throw error;
    }
  },
};
