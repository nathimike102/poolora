/**
 * services/bookingService.ts
 *
 * Booking operations API integration
 * Handles ride booking creation and management
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type {
  ApiResponse,
  Booking,
  BookingStatus,
  CancellationQuote,
  Receipt,
  BookingQuote,
  CreateBookingRequest,
  CreateBookingResult,
  PaginatedResponse,
  PaginatedResult,
} from '../types/api';

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
  /** The fare, what the rider's company pays and the rest, before booking (UC-C01) */
  async quote(data: Omit<CreateBookingRequest, 'useWallet' | 'note'>): Promise<BookingQuote> {
    const response = await apiClient.post<ApiResponse<BookingQuote>>(API_ENDPOINTS.bookings.quote, data);
    return response.data.data;
  },

  async createBooking(bookingData: CreateBookingRequest): Promise<CreateBookingResult> {
    try {
      const response = await apiClient.post<ApiResponse<CreateBookingResult>>(
        API_ENDPOINTS.bookings.create,
        bookingData,
      );
      logger.info('Booking created successfully', { bookingId: response.data.data.booking?._id });
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
    status?: BookingStatus,
  ): Promise<PaginatedResponse<Booking>> {
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) queryParams.append('status', status);

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
    status?: BookingStatus,
  ): Promise<PaginatedResponse<Booking>> {
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) queryParams.append('status', status);

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
  async cancelBooking(bookingId: string, reason?: string): Promise<Booking> {
    try {
      const response = await apiClient.post<ApiResponse<Booking>>(
        API_ENDPOINTS.bookings.cancel(bookingId),
        reason ? { reason } : {},
      );
      logger.info('Booking cancelled successfully', { bookingId });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to cancel booking', { error, bookingId });
      throw error;
    }
  },

  /**
   * What the rider would get back for cancelling now
   *
   * @param bookingId - Booking the rider is thinking of cancelling
   * @returns Refund amount and the policy behind it
   */
  async getCancellationQuote(bookingId: string): Promise<CancellationQuote> {
    const response = await apiClient.get<ApiResponse<CancellationQuote>>(
      API_ENDPOINTS.bookings.cancellationQuote(bookingId),
    );
    return response.data.data;
  },

  /** Driver steps during the ride: at the pickup, rider in the car, rider dropped, rider did not come */
  async driverStep(bookingId: string, step: 'arrived' | 'pickedUp' | 'droppedOff' | 'noShow', pin?: string): Promise<Booking> {
    // "Picked up" carries the rider's 4-digit pickup code
    const response = await apiClient.post<ApiResponse<{ booking: Booking }>>(API_ENDPOINTS.bookings[step](bookingId), pin ? { pin } : undefined);
    return response.data.data.booking;
  },

  /** The rider confirms they are in the car, when the code cannot be exchanged */
  async riderInCar(bookingId: string): Promise<Booking> {
    const response = await apiClient.post<ApiResponse<{ booking: Booking }>>(API_ENDPOINTS.bookings.inCar(bookingId));
    return response.data.data.booking;
  },

  /** A link trusted contacts can open without the app to follow this trip */
  async shareTrip(bookingId: string): Promise<{ url: string; expiresAt: string }> {
    const response = await apiClient.post<ApiResponse<{ url: string; expiresAt: string }>>(API_ENDPOINTS.bookings.share(bookingId));
    return response.data.data;
  },

  async getReceipt(bookingId: string): Promise<{ receipt: Receipt; text: string }> {
    const response = await apiClient.get<ApiResponse<{ receipt: Receipt; text: string }>>(API_ENDPOINTS.bookings.receipt(bookingId));
    return response.data.data;
  },

  /** Sends a copy of the receipt to the user's email address */
  async emailReceipt(bookingId: string): Promise<{ sent: boolean; to?: string }> {
    const response = await apiClient.post<ApiResponse<{ sent: boolean; to?: string }>>(API_ENDPOINTS.bookings.emailReceipt(bookingId));
    return response.data.data;
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
