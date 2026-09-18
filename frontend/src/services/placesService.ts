/**
 * services/placesService.ts
 *
 * Place suggestions and geocoding through the Sanchari backend, which keeps the
 * Google Maps key server-side and caches responses.
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

export interface PlaceSuggestion {
  placeId: string;
  name: string;
  subtitle: string;
}

export interface GeocodedPlace {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
}

/**
 * Fetch up to 5 place suggestions in India. Callers should debounce input.
 */
export async function fetchPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  if (input.trim().length < 2) return [];

  const response = await apiClient.get<
    ApiResponse<{ results: Array<{ placeId: string; mainText: string; secondaryText: string }> }>
  >(API_ENDPOINTS.maps.autocomplete, { params: { input } });

  return response.data.data.results.map(r => ({
    placeId: r.placeId,
    name: r.mainText,
    subtitle: r.secondaryText,
  }));
}

/** Resolve an address to coordinates. */
export async function geocodePlace(address: string): Promise<GeocodedPlace> {
  const response = await apiClient.get<ApiResponse<GeocodedPlace>>(API_ENDPOINTS.maps.geocode, {
    params: { address },
  });
  return response.data.data;
}

/** Address for coordinates, e.g. a point pinned on the map. */
export async function reverseGeocodePlace(lat: number, lng: number): Promise<GeocodedPlace> {
  const response = await apiClient.get<ApiResponse<GeocodedPlace>>(API_ENDPOINTS.maps.reverseGeocode, {
    params: { lat, lng },
  });
  return response.data.data;
}

/** The text to put in an input when a suggestion is chosen. */
export function suggestionLabel(s: PlaceSuggestion): string {
  return s.subtitle ? `${s.name}, ${s.subtitle}` : s.name;
}
