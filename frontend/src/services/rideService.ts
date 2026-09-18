/**
 * services/rideService.ts
 *
 * Ride operations API integration
 * Handles ride search, creation, and management
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type {
  ApiResponse,
  Ride,
  CreateRideRequest,
  SearchRidesRequest,
  PaginatedResponse,
  PaginatedResult,
  GeoPoint,
  Location,
  RidePreferences,
  UpcomingBooking,
} from '../types/api';

type BackendPlace = { location?: { coordinates?: [number, number] }; address?: string };

function toLocation(place: BackendPlace | undefined): Location {
  const [lng, lat] = place?.location?.coordinates ?? [0, 0];
  return { lat, lng, address: place?.address };
}

/**
 * The backend returns `{ ride }` using its own field names (pickup, dropoff,
 * departureTime, preferences). Map that to the app's Ride shape so screens
 * render real values instead of falling back to placeholders.
 */
export function normalizeRide(payload: unknown): Ride {
  const raw = ((payload as { ride?: unknown })?.ride ?? payload) as Record<string, any>;
  if (!raw || raw.pickupLocation) return raw as Ride;
  const preferences = raw.preferences as RidePreferences | undefined;
  return {
    ...raw,
    pickupLocation: toLocation(raw.pickup),
    dropoffLocation: toLocation(raw.dropoff),
    scheduledDeparture: raw.departureTime,
    estimatedArrival: raw.estimatedArrivalTime,
    seats: raw.totalSeats,
    availableSeats: raw.availableSeats,
    womenOnly: Boolean(preferences?.womenOnly),
    hasAC: Boolean(raw.vehicle?.hasAC),
    allowLuggage: preferences ? preferences.luggageSize !== 'none' : false,
    preferences,
  } as Ride;
}

/**
 * Service for all ride-related operations
 */
export const rideService = {
  /**
   * Search for available rides
   *
   * @param params - Search parameters (location, time, filters)
   * @param page - Page number for pagination
   * @param limit - Results per page
   * @returns List of matching rides
   */
  async searchRides(
    params: SearchRidesRequest,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Ride>> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
      queryParams.append('page', String(page));
      queryParams.append('limit', String(limit));

      const response = await apiClient.get<ApiResponse<PaginatedResult<Ride>>>(
        `${API_ENDPOINTS.rides.search}?${queryParams.toString()}`,
      );

      const items = (response.data.data.items ?? []).map(normalizeRide);
      logger.info('Rides searched successfully', { count: items.length, total: response.data.data.total });

      return { ...response.data, data: { ...response.data.data, items } };
    } catch (error) {
      logger.error('Failed to search rides', { error });
      throw error;
    }
  },

  /**
   * Create a new ride
   *
   * @param rideData - Ride creation data
   * @returns Created ride
   */
  async createRide(rideData: CreateRideRequest): Promise<Ride> {
    try {
      const response = await apiClient.post<ApiResponse<unknown>>(API_ENDPOINTS.rides.create, rideData);
      const ride = normalizeRide(response.data.data);
      logger.info('Ride created successfully', { rideId: ride._id });
      return ride;
    } catch (error) {
      logger.error('Failed to create ride', { error });
      throw error;
    }
  },

  /**
   * Get ride details
   *
   * @param rideId - Ride ID
   * @returns Ride details
   */
  async getRide(rideId: string): Promise<Ride> {
    try {
      const response = await apiClient.get<ApiResponse<unknown>>(API_ENDPOINTS.rides.detail(rideId));
      return normalizeRide(response.data.data);
    } catch (error) {
      logger.error('Failed to get ride', { error, rideId });
      throw error;
    }
  },

  /**
   * Get rides created by current driver
   *
   * @param status - Filter by ride status (optional)
   * @param page - Page number
   * @param limit - Results per page
   * @returns Driver's rides
   */
  async getMyRides(
    status?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Ride>> {
    try {
      const queryParams = new URLSearchParams();
      if (status) queryParams.append('status', status);
      queryParams.append('page', String(page));
      queryParams.append('limit', String(limit));

      const response = await apiClient.get<ApiResponse<PaginatedResult<Ride>>>(
        `${API_ENDPOINTS.rides.myRides}?${queryParams.toString()}`,
      );

      const items = (response.data.data.items ?? []).map(normalizeRide);
      logger.info('Driver rides fetched', { count: items.length });
      return { ...response.data, data: { ...response.data.data, items } };
    } catch (error) {
      logger.error('Failed to get driver rides', { error });
      throw error;
    }
  },

  /**
   * Get upcoming rides booked by current rider
   *
   * @returns Upcoming rides
   */
  async getUpcomingRides(): Promise<UpcomingBooking[]> {
    try {
      // Backend responds with { rides: [{ id, bookingId, pickup, dropoff, departureTime, pricePerSeat, driver, status }] }
      const response = await apiClient.get<ApiResponse<{ rides: Array<Record<string, any>> }>>(API_ENDPOINTS.rides.upcoming);
      const rides = (response.data.data.rides ?? []).map(r => ({
        rideId: String(r.id),
        bookingId: String(r.bookingId),
        from: r.pickup?.address ?? '',
        to: r.dropoff?.address ?? '',
        departureTime: r.departureTime,
        pricePerSeat: r.pricePerSeat,
        driverName: r.driver?.name ?? 'Driver',
        status: r.status,
      }));
      logger.info('Upcoming rides fetched', { count: rides.length });
      return rides;
    } catch (error) {
      logger.error('Failed to get upcoming rides', { error });
      throw error;
    }
  },

  /**
   * Cancel a ride
   *
   * @param rideId - Ride ID to cancel
   * @returns Updated ride
   */
  async cancelRide(rideId: string): Promise<Ride> {
    try {
      const response = await apiClient.post<ApiResponse<Ride>>(API_ENDPOINTS.rides.cancel(rideId), {});
      logger.info('Ride cancelled successfully', { rideId });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to cancel ride', { error, rideId });
      throw error;
    }
  },

  /**
   * Complete a ride
   *
   * @param rideId - Ride ID to complete
   * @returns Updated ride
   */
  async completeRide(rideId: string): Promise<Ride> {
    try {
      const response = await apiClient.post<ApiResponse<Ride>>(API_ENDPOINTS.rides.complete(rideId), {});
      logger.info('Ride completed successfully', { rideId });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to complete ride', { error, rideId });
      throw error;
    }
  },

  /**
   * Update driver location (for tracking)
   *
   * @param location - Current location coordinates
   */
  async updateDriverLocation(location: GeoPoint): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.rides.updateLocation, location);
      logger.debug('Driver location updated');
    } catch (error) {
      logger.error('Failed to update driver location', { error });
      throw error;
    }
  },
};
