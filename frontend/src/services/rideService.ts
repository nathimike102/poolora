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
  CreateRideResult,
  PriceSuggestion,
  SearchRidesRequest,
  PaginatedResponse,
  PaginatedResult,
  Location,
  RidePreferences,
  UpcomingBooking,
} from '../types/api';

type BackendPlace = { location?: { coordinates?: [number, number] }; address?: string };

/** A ride as the backend sends it. */
type BackendRide = Record<string, unknown> & {
  pickup?: BackendPlace;
  dropoff?: BackendPlace;
  pickupLocation?: unknown;
  departureTime?: string;
  estimatedArrivalTime?: string;
  totalSeats?: number;
  availableSeats?: number;
  vehicle?: { hasAC?: boolean };
  preferences?: RidePreferences;
};

/** One entry of GET /rides/upcoming. */
type BackendUpcomingRide = {
  id: string;
  bookingId: string;
  pickup?: BackendPlace;
  dropoff?: BackendPlace;
  departureTime: UpcomingBooking['departureTime'];
  pricePerSeat: UpcomingBooking['pricePerSeat'];
  driver?: { name?: string };
  status: UpcomingBooking['status'];
};

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
  const raw = ((payload as { ride?: unknown })?.ride ?? payload) as BackendRide;
  if (!raw || raw.pickupLocation) return raw as unknown as Ride;
  const preferences = raw.preferences;
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
  } as unknown as Ride;
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
      const found = response.data.data.alternatives;
      const alternatives = found ? { ...found, items: found.items.map(normalizeRide) } : undefined;
      logger.info('Rides searched successfully', { count: items.length, total: response.data.data.total, alternatives: alternatives?.total ?? 0 });

      return { ...response.data, data: { ...response.data.data, items, alternatives } };
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
  async createRide(rideData: CreateRideRequest): Promise<CreateRideResult> {
    try {
      const response = await apiClient.post<ApiResponse<{ ride: unknown; returnRide?: unknown; returnError?: string }>>(API_ENDPOINTS.rides.create, rideData);
      const data = response.data.data;
      const ride = normalizeRide(data.ride ?? data);
      logger.info('Ride created successfully', { rideId: ride._id });
      return {
        ride,
        returnRide: data.returnRide ? normalizeRide(data.returnRide) : undefined,
        returnError: data.returnError,
      };
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
      const response = await apiClient.get<ApiResponse<{ rides: BackendUpcomingRide[] }>>(API_ENDPOINTS.rides.upcoming);
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
   * The suggested seat price and the range the driver may choose from, for a
   * route through optional stops (UC-D02 steps 6-7)
   */
  async getPriceSuggestion(params: {
    pickup: { lat: number; lng: number };
    dropoff: { lat: number; lng: number };
    departureTime: string;
    vehicleType?: string;
    stops?: Array<{ lat: number; lng: number }>;
  }): Promise<PriceSuggestion> {
    const response = await apiClient.get<ApiResponse<PriceSuggestion>>(API_ENDPOINTS.rides.priceSuggestion, {
      params: {
        pickupLat: params.pickup.lat,
        pickupLng: params.pickup.lng,
        dropoffLat: params.dropoff.lat,
        dropoffLng: params.dropoff.lng,
        departureTime: params.departureTime,
        vehicleType: params.vehicleType,
        stops: params.stops?.length ? params.stops.map(p => `${p.lat},${p.lng}`).join('|') : undefined,
      },
    });
    return response.data.data;
  },

  /** One message to every confirmed rider on the ride (UC-D06 step 6) */
  async messageAllRiders(rideId: string, content: string): Promise<{ sent: number }> {
    const response = await apiClient.post<ApiResponse<{ sent: number }>>(API_ENDPOINTS.rides.messageRiders(rideId), { content });
    return response.data.data;
  },

  /**
   * Change a published ride: departure within 2 hours, more seats, or the
   * price while nobody has booked. Booked riders are told.
   */
  async updateRide(rideId: string, changes: { departureTime?: string; totalSeats?: number; pricePerSeat?: number }): Promise<Ride> {
    const response = await apiClient.patch<ApiResponse<{ ride: unknown }>>(API_ENDPOINTS.rides.detail(rideId), changes);
    return normalizeRide(response.data.data.ride);
  },

  /**
   * Start a ride: the driver has set off with confirmed riders
   */
  async startRide(rideId: string): Promise<Ride> {
    try {
      const response = await apiClient.post<ApiResponse<{ ride: unknown }>>(API_ENDPOINTS.rides.start(rideId), {});
      logger.info('Ride started', { rideId });
      return normalizeRide(response.data.data);
    } catch (error) {
      logger.error('Failed to start ride', { error, rideId });
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
   * Send the driver's position for one booking so its rider can follow the car
   */
  async updateDriverLocation(update: {
    bookingId: string;
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
  }): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.rides.updateLocation, { ...update, timestamp: Date.now() }, {
        // A missed fix is replaced by the next one a few seconds later
        noRetry: true,
      });
    } catch (error) {
      logger.error('Failed to update driver location', { error });
      throw error;
    }
  },
};
