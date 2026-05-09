/**
 * services/bookingService.ts
 *
 * Booking operations API integration
 * Handles ride booking creation and management
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse, Booking, CreateBookingRequest, PaginatedResponse, PaginatedResult } from '../types/api';

/**
 * Service for all booking-related operations
 */
export const bookingService = {
  /**
   * Create a new booking
   *
   * @param bookingData - Booking creation data
   * @returns Created booking
   */
  async createBooking(bookingData: CreateBookingRequest): Promise<Booking> {
    try {
      const response = await apiClient.post<ApiResponse<Booking>>(
        API_ENDPOINTS.bookings.create,
        bookingData,
      );
      logger.info('Booking created successfully', { bookingId: response.data.data._id });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to create booking', { error });
      throw error;
    }
  },

  /**
   * Get all bookings made by current rider
   *
   * @param page - Page number
   * @param limit - Results per page
   * @returns Rider's bookings
   */
  async getRiderBookings(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Booking>> {
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      const response = await apiClient.get<ApiResponse<PaginatedResult<Booking>>>(
        `${API_ENDPOINTS.bookings.riderBookings}?${queryParams.toString()}`,
      );

      logger.info('Rider bookings fetched', { count: response.data.data.items?.length || 0 });
      return response.data;
    } catch (error) {
      logger.error('Failed to get rider bookings', { error });
      throw error;
    }
  },

  /**
   * Get all bookings for driver's rides
   *
   * @param page - Page number
   * @param limit - Results per page
   * @returns Driver's incoming bookings
   */
  async getDriverBookings(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Booking>> {
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      const response = await apiClient.get<ApiResponse<PaginatedResult<Booking>>>(
        `${API_ENDPOINTS.bookings.driverBookings}?${queryParams.toString()}`,
      );

      logger.info('Driver bookings fetched', { count: response.data.data.items?.length || 0 });
      return response.data;
    } catch (error) {
      logger.error('Failed to get driver bookings', { error });
      throw error;
    }
  },

  /**
   * Confirm a booking
   *
   * @param bookingId - Booking ID to confirm
   * @returns Updated booking
   */
  async confirmBooking(bookingId: string): Promise<Booking> {
    try {
      const response = await apiClient.post<ApiResponse<Booking>>(
        API_ENDPOINTS.bookings.confirm(bookingId),
        {},
      );
      logger.info('Booking confirmed successfully', { bookingId });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to confirm booking', { error, bookingId });
      throw error;
    }
  },

  /**
   * Reject a booking
   *
   * @param bookingId - Booking ID to reject
   * @returns Updated booking
   */
  async rejectBooking(bookingId: string): Promise<Booking> {
    try {
      const response = await apiClient.post<ApiResponse<Booking>>(
        API_ENDPOINTS.bookings.reject(bookingId),
        {},
      );
      logger.info('Booking rejected successfully', { bookingId });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to reject booking', { error, bookingId });
      throw error;
    }
  },

  /**
   * Cancel a booking
   *
   * @param bookingId - Booking ID to cancel
   * @returns Updated booking
   */
  async cancelBooking(bookingId: string): Promise<Booking> {
    try {
      const response = await apiClient.post<ApiResponse<Booking>>(
        API_ENDPOINTS.bookings.cancel(bookingId),
        {},
      );
      logger.info('Booking cancelled successfully', { bookingId });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to cancel booking', { error, bookingId });
      throw error;
    }
  },

  /**
   * Complete a booking
   *
   * @param bookingId - Booking ID to complete
   * @returns Updated booking
   */
  async completeBooking(bookingId: string): Promise<Booking> {
    try {
      const response = await apiClient.post<ApiResponse<Booking>>(
        API_ENDPOINTS.bookings.complete(bookingId),
        {},
      );
      logger.info('Booking completed successfully', { bookingId });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to complete booking', { error, bookingId });
      throw error;
    }
  },
};
