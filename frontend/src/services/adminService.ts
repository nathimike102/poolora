/**
 * services/adminService.ts
 *
 * Admin dashboard API integration — connects frontend admin screens
 * with backend AdminController endpoints.
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse } from '../types/api';

export interface SystemMetrics {
  totalRides: number;
  activeRides: number;
  completedToday: number;
  revenue: number;
  avgRating: number;
  totalUsers: number;
  activeDrivers: number;
  activeRiders: number;
}

export interface AdminRide {
  _id: string;
  driver: { name: string; phone: string; profilePicture?: string };
  status: string;
  pickup: { address: string };
  dropoff: { address: string };
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  createdAt: string;
}

export interface AdminUser {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  capabilities: string[];
  gender?: string;
  kyc: { status: string; submittedAt?: string };
  stats: { totalRidesAsDriver: number; totalRidesAsRider: number; avgRatingAsDriver: number };
  isSuspended: boolean;
  createdAt: string;
}

export interface AdminPayment {
  _id: string;
  amount: number;
  status: string;
  method: string;
  booking: { rider: string; driver: string };
  createdAt: string;
}

export interface PaginatedResponse<T> {
  pagination: { page: number; limit: number; total: number };
  [key: string]: T[] | { page: number; limit: number; total: number };
}

/**
 * Admin API service
 */
export const adminService = {
  /**
   * Get system metrics
   */
  async getMetrics(): Promise<SystemMetrics> {
    try {
      const response = await apiClient.get<ApiResponse<{ metrics: SystemMetrics }>>(
        API_ENDPOINTS.admin.metrics,
      );
      logger.info('Admin metrics fetched');
      return response.data.data.metrics;
    } catch (error) {
      logger.error('Failed to fetch admin metrics', { error });
      throw error;
    }
  },

  /**
   * Get all rides with filtering
   */
  async getRides(params?: { status?: string; page?: number; limit?: number }): Promise<{
    rides: AdminRide[];
    pagination: { page: number; limit: number; total: number };
  }> {
    try {
      const response = await apiClient.get<
        ApiResponse<{ rides: AdminRide[]; pagination: { page: number; limit: number; total: number } }>
      >(API_ENDPOINTS.admin.rides, { params });
      logger.info('Admin rides fetched');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to fetch admin rides', { error });
      throw error;
    }
  },

  /**
   * Get all users with filtering
   */
  async getUsers(params?: { role?: string; kycStatus?: string; page?: number; limit?: number }): Promise<{
    users: AdminUser[];
    pagination: { page: number; limit: number; total: number };
  }> {
    try {
      const response = await apiClient.get<
        ApiResponse<{ users: AdminUser[]; pagination: { page: number; limit: number; total: number } }>
      >(API_ENDPOINTS.admin.users, { params });
      logger.info('Admin users fetched');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to fetch admin users', { error });
      throw error;
    }
  },

  /**
   * Get payment information
   */
  async getPayments(params?: { status?: string; page?: number; limit?: number }): Promise<{
    payments: AdminPayment[];
    pagination: { page: number; limit: number; total: number };
  }> {
    try {
      const response = await apiClient.get<
        ApiResponse<{ payments: AdminPayment[]; pagination: { page: number; limit: number; total: number } }>
      >(API_ENDPOINTS.admin.payments, { params });
      logger.info('Admin payments fetched');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to fetch admin payments', { error });
      throw error;
    }
  },

  /**
   * Submitted KYC details with short-lived document links
   */
  async getKycDocuments(userId: string): Promise<KycReview> {
    const response = await apiClient.get<ApiResponse<KycReview>>(API_ENDPOINTS.admin.kycDocuments(userId));
    return response.data.data;
  },

  async approveKyc(userId: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.auth.approveKyc(userId));
    logger.info('KYC approved', { userId });
  },

  async rejectKyc(userId: string, reason: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.auth.rejectKyc(userId), { reason });
    logger.info('KYC rejected', { userId });
  },
};

export interface KycReview {
  name: string;
  status: string;
  licenseNumber?: string;
  vehicle?: { make: string; model: string; year: number; color: string; plateNumber: string; vehicleType: string };
  documents: {
    licence: string | null;
    registration: string | null;
    insurance: string | null;
    photos: (string | null)[];
  };
}
