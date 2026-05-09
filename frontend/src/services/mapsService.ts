/**
 * services/mapsService.ts
 *
 * Maps and geocoding operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse } from '../types/api';

export interface GeocodingResult {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface DistanceResult {
  distance: number; // in meters
  duration: number; // in seconds
}

/**
 * Service for maps operations
 */
export const mapsService = {
  /**
   * Validate and normalize an address string.
   */
  async geocode(address: string): Promise<GeocodingResult> {
    try {
      const response = await apiClient.post<ApiResponse<any>>(API_ENDPOINTS.maps.validateAddress, {
        address,
      });
      logger.info('Address geocoded', { address });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to geocode address', { error, address });
      throw error;
    }
  },

  /**
   * Get distance between two locations
   */
  async getDistance(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ): Promise<DistanceResult> {
    try {
      const query = new URLSearchParams({
        originLat: String(fromLat),
        originLng: String(fromLng),
        destLat: String(toLat),
        destLng: String(toLng),
      });
      const response = await apiClient.get<ApiResponse<DistanceResult>>(
        `${API_ENDPOINTS.maps.distance}?${query.toString()}`,
      );
      logger.info('Distance calculated');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get distance', { error });
      throw error;
    }
  },

  /**
   * Get directions between two locations
   */
  async getDirections(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ): Promise<any> {
    try {
      const query = new URLSearchParams({
        originLat: String(fromLat),
        originLng: String(fromLng),
        destLat: String(toLat),
        destLng: String(toLng),
      });
      const response = await apiClient.get<ApiResponse<any>>(
        `${API_ENDPOINTS.maps.directions}?${query.toString()}`,
      );
      logger.info('Directions fetched');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get directions', { error });
      throw error;
    }
  },
};
