/**
 * The parts of Google's Maps responses this codebase reads.
 *
 * These are deliberately partial: Google returns far more than we use, and
 * fields are optional because a response can legitimately omit them (a step
 * without a maneuver, a place without a rating). Typing them stops a missing
 * field from surfacing as `undefined is not an object` at runtime.
 */

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface ValueUnit {
  value: number;
  text?: string;
}

// ─── Places Autocomplete ─────────────────────────────────────────────────────
export interface PlacePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

// ─── Directions ──────────────────────────────────────────────────────────────
export interface DirectionsStep {
  html_instructions?: string;
  polyline?: { points?: string };
  distance: ValueUnit;
  duration: ValueUnit;
  maneuver?: string;
  start_location: LatLngLiteral;
  end_location: LatLngLiteral;
}

export interface DirectionsLeg {
  steps?: DirectionsStep[];
  distance: ValueUnit;
  duration: ValueUnit;
  start_address: string;
  end_address: string;
  start_location: LatLngLiteral;
  end_location: LatLngLiteral;
}

export interface DirectionsRoute {
  legs: DirectionsLeg[];
  bounds?: { northeast: LatLngLiteral; southwest: LatLngLiteral };
  waypoint_order?: number[];
  overview_polyline?: { points?: string };
  summary?: string;
}

// ─── Distance Matrix ─────────────────────────────────────────────────────────
export interface DistanceMatrixElement {
  status: string;
  distance?: ValueUnit;
  duration?: ValueUnit;
}

export interface DistanceMatrixRow {
  elements: DistanceMatrixElement[];
}

/** One driver's distance to the pickup point, as this service reports it. */
export interface DriverDistance {
  driverLat: number;
  driverLng: number;
  distanceKm: number;
  durationMins: number;
}

// ─── Routes API (v2) ─────────────────────────────────────────────────────────
export interface ComputedRoute {
  distanceMeters?: number;
  description?: string;
  /** A duration in seconds with a trailing "s", e.g. "1234s". */
  duration?: string;
  staticDuration?: string;
  polyline?: { encodedPolyline?: string };
  travelAdvisory?: {
    tollInfo?: unknown;
    speedReadingIntervals?: unknown[];
  };
}

// ─── Places (new and legacy shapes) ──────────────────────────────────────────
export interface PlaceV1 {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  rating?: number;
  currentOpeningHours?: { openNow?: boolean };
}

export interface PlaceLegacy {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: LatLngLiteral };
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now?: boolean };
  vicinity?: string;
}

// ─── Address Validation ──────────────────────────────────────────────────────
export interface AddressComponentV1 {
  componentName?: { text?: string };
  componentType?: string;
  confirmationLevel?: string;
}

// ─── Geolocation ─────────────────────────────────────────────────────────────
export interface GeolocationRequestBody {
  considerIp: boolean;
  wifiAccessPoints?: Array<Record<string, unknown>>;
  cellTowers?: Array<Record<string, unknown>>;
}

/** Every classic Maps web service answers with a status and, on failure, a message. */
export interface GoogleStatusResponse {
  status?: string;
  error_message?: string;
}

export interface GeocodeApiResult {
  formatted_address?: string;
  place_id?: string;
  geometry?: { location?: LatLngLiteral; location_type?: string };
  address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
  types?: string[];
}

export type AutocompleteResponse = GoogleStatusResponse & { predictions?: PlacePrediction[] };
export type GeocodeResponse = GoogleStatusResponse & { results?: GeocodeApiResult[] };
export type DirectionsResponse = GoogleStatusResponse & { routes?: DirectionsRoute[] };
export type DistanceMatrixResponse = GoogleStatusResponse & {
  rows?: DistanceMatrixRow[];
  origin_addresses?: string[];
  destination_addresses?: string[];
};
export type NearbySearchResponse = GoogleStatusResponse & { results?: PlaceLegacy[] };
export type RoutesApiResponse = { routes?: ComputedRoute[] };
export type PlacesV1Response = { places?: PlaceV1[] };
export type GeolocationResponse = {
  location?: { lat?: number; lng?: number };
  accuracy?: number;
};
export type AddressValidationResponse = {
  result?: {
    geocode?: { location?: { latitude?: number; longitude?: number }; placeId?: string };
    verdict?: {
      hasUnconfirmedComponents?: boolean;
      hasReplacedComponents?: boolean;
      hasInferredComponents?: boolean;
      addressComplete?: boolean;
      inputGranularity?: string;
      validationGranularity?: string;
    };
    address?: { formattedAddress?: string; addressComponents?: AddressComponentV1[] };
  };
};
