/**
 * services/walletService.ts
 *
 * Wallet and transaction operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, Wallet, Transaction, PaginatedResponse, PaginatedResult } from '../types/api';

export interface TopUpResult {
  transactionId: string;
  balance: number;
  [key: string]: unknown;
}

export interface ConvertCoinsResult {
  coins: number;
  cashAmount: number;
  [key: string]: unknown;
}

/**
 * Service for wallet operations
 */
export const walletService = {
  /**
   * Get wallet balance
   */
  async getBalance(): Promise<Wallet> {
    try {
      // The backend responds with { wallet, benefits }
      const response = await apiClient.get<ApiResponse<{ wallet: Wallet } | Wallet>>(API_ENDPOINTS.wallet.wallet);
      const data = response.data.data;
      const wallet = 'wallet' in data ? data.wallet : data;
      logger.info('Wallet balance fetched');
      return wallet;
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
  async topUp(amount: number): Promise<TopUpResult> {
    try {
      const response = await apiClient.post<ApiResponse<TopUpResult>>(API_ENDPOINTS.wallet.topUp, { amount });
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
  async convertCoins(coins: number): Promise<ConvertCoinsResult> {
    try {
      const response = await apiClient.post<ApiResponse<ConvertCoinsResult>>(API_ENDPOINTS.wallet.convertCoins, { coins });
      logger.info('Coins converted', { coins });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to convert coins', { error, coins });
      throw error;
    }
  },
};
