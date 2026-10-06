/**
 * services/placesService.ts
 *
 * Place suggestions and geocoding through the Poolora backend, which keeps the
 * Google Maps key server-side and caches responses.
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

export interface PlaceSuggestion {
  placeId: string;
  name: string;
  subtitle: string;
  /** A kombi rank or bus terminus (UC-R12), which comes with its exact position */
  hub?: 'kombi_rank' | 'bus_terminus';
  lat?: number;
  lng?: number;
}

export interface GeocodedPlace {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
}

/**
 * Fetch place suggestions in the market's country, ranks and termini first.
 * Callers should debounce input.
 * `near` (the user's position) ranks nearby places first.
 */
export async function fetchPlaceSuggestions(input: string, near?: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
  if (input.trim().length < 2) return [];

  const response = await apiClient.get<
    ApiResponse<{ results: Array<{ placeId: string; mainText: string; secondaryText: string; hub?: PlaceSuggestion['hub']; lat?: number; lng?: number }> }>
  >(API_ENDPOINTS.maps.autocomplete, {
    params: near ? { input, lat: near.lat, lng: near.lng } : { input },
    // The next keystroke supersedes this request, so a retry is pointless.
    noRetry: true,
  });

  return response.data.data.results.map(r => ({
    placeId: r.placeId,
    name: r.mainText,
    subtitle: r.secondaryText,
    ...(r.hub ? { hub: r.hub, lat: r.lat, lng: r.lng } : {}),
  }));
}

/**
 * Ranks and termini chosen from the suggestions, by the text they put in the
 * field: an admin placed each pin, so that exact position is used, not a
 * search for the text.
 */
const chosenHubs = new Map<string, GeocodedPlace>();

/** Resolve an address to coordinates. */
export async function geocodePlace(address: string): Promise<GeocodedPlace> {
  const hub = chosenHubs.get(address.trim());
  if (hub) return hub;
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

/**
 * A place whose position is already known (pinned on the map, or where the
 * phone is), so geocodePlace returns that point rather than a lookup of its
 * address, which can land somewhere else.
 */
export function rememberExactPlace(label: string, lat: number, lng: number): void {
  chosenHubs.set(label.trim(), { formattedAddress: label, lat, lng, placeId: `pin:${lat},${lng}` });
}

/** The text to put in an input when a suggestion is chosen. */
export function suggestionLabel(s: PlaceSuggestion): string {
  return s.subtitle ? `${s.name}, ${s.subtitle}` : s.name;
}

/** A suggestion was chosen: its text for the input, keeping a rank's or terminus's exact position for geocodePlace. */
export function choosePlace(s: PlaceSuggestion): string {
  const label = suggestionLabel(s);
  if (s.hub && s.lat != null && s.lng != null) chosenHubs.set(label, { formattedAddress: label, lat: s.lat, lng: s.lng, placeId: s.placeId });
  return label;
}
