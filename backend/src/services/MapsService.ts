import axios from 'axios';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const GOOGLE_MAPS_BASE = 'https://maps.googleapis.com/maps/api';

function getApiKey(): string {
  const key = config.maps.googleMapsKey;
  if (!key) {
    throw new AppError(
      'Google Maps API key is not configured. Set GOOGLE_MAPS_API_KEY in .env',
      503,
      'MAPS_SERVICE_UNAVAILABLE',
    );
  }
  return key;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeocodeResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
}

export interface ReverseGeocodeResult {
  formattedAddress: string;
  placeId: string;
  addressComponents: Array<{ long_name: string; short_name: string; types: string[] }>;
}

export interface RouteResult {
  distanceKm: number;
  durationMins: number;
  polyline: string;
  startAddress: string;
  endAddress: string;
}

export interface AutocompleteResult {
  description: string;
  placeId: string;
}

export interface DistanceResult {
  distanceKm: number;
  durationMins: number;
  originAddress: string;
  destinationAddress: string;
}

export interface DirectionsResult {
  distanceKm: number;
  durationMins: number;
  polyline: string;
  startAddress: string;
  endAddress: string;
  steps: Array<{
    instruction: string;
    distanceKm: number;
    durationMins: number;
  }>;
  waypoints: Array<{ lat: number; lng: number }>;
}

export interface DistanceMatrixResult {
  rows: Array<{
    driverLat: number;
    driverLng: number;
    distanceKm: number;
    durationMins: number;
  }>;
  nearestDriver: {
    index: number;
    driverLat: number;
    driverLng: number;
    distanceKm: number;
    durationMins: number;
  } | null;
}

export interface TrafficAwareRouteResult {
  distanceKm: number;
  durationMins: number;
  staticDurationMins: number;
  polyline: string;
  description: string;
  travelAdvisory: any;
}

export interface GeolocationResult {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface OptimizedRouteResult {
  optimizedWaypointOrder: number[];
  routes: Array<{
    legIndex: number;
    startAddress: string;
    endAddress: string;
    distanceKm: number;
    durationMins: number;
  }>;
  totalDistanceKm: number;
  totalDurationMins: number;
  polyline: string;
}

export interface NavigationStep {
  instruction: string;
  distanceKm: number;
  durationMins: number;
  maneuver: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  polyline: string;
}

export interface NavigationResult {
  steps: NavigationStep[];
  totalDistanceKm: number;
  totalDurationMins: number;
  overviewPolyline: string;
  startAddress: string;
  endAddress: string;
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
}

export interface MapsGroundingResult {
  places: Array<{
    placeId: string;
    name: string;
    formattedAddress: string;
    lat: number;
    lng: number;
    types: string[];
    rating?: number;
    openNow?: boolean;
  }>;
  attributions: string[];
}

export interface PlacesAggregateResult {
  places: Array<{
    placeId: string;
    name: string;
    formattedAddress: string;
    lat: number;
    lng: number;
    types: string[];
    rating?: number;
    userRatingsTotal?: number;
    openNow?: boolean;
    vicinity: string;
  }>;
  totalResults: number;
}

export interface AddressValidationResult {
  isValid: boolean;
  formattedAddress: string;
  addressComponents: Array<{
    componentName: string;
    componentType: string;
    confirmed: boolean;
  }>;
  lat: number;
  lng: number;
  verdict: {
    inputGranularity: string;
    validationGranularity: string;
    hasUnconfirmedComponents: boolean;
    hasInferredComponents: boolean;
    hasReplacedComponents: boolean;
  };
}

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Autocomplete a place search input using Google Places API.
 */
export async function autocomplete(input: string): Promise<AutocompleteResult[]> {
  try {
    const response = await axios.get(`${GOOGLE_MAPS_BASE}/place/autocomplete/json`, {
      params: {
        input,
        components: 'country:in',
        key: getApiKey(),
      },
    });

    const data = response.data;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new AppError(
        `Autocomplete failed: ${data.status} — ${data.error_message || 'Unknown error'}`,
        400,
        'AUTOCOMPLETE_FAILED',
      );
    }

    return (data.predictions ?? []).slice(0, 5).map((p: any) => ({
      description: p.description,
      placeId: p.place_id,
    }));
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Autocomplete request failed', { error: error.message, input });
    throw new AppError('Autocomplete service unavailable', 502, 'AUTOCOMPLETE_ERROR');
  }
}

/**
 * Geocode an address string to lat/lng coordinates.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  try {
    const response = await axios.get(`${GOOGLE_MAPS_BASE}/geocode/json`, {
      params: {
        address,
        key: getApiKey(),
      },
    });

    const data = response.data;
    if (data.status !== 'OK' || !data.results?.length) {
      throw new AppError(
        `Geocoding failed: ${data.status} — ${data.error_message || 'No results found'}`,
        400,
        'GEOCODING_FAILED',
      );
    }

    const result = data.results[0];
    return {
      formattedAddress: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      placeId: result.place_id,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Geocoding request failed', { error: error.message, address });
    throw new AppError('Geocoding service unavailable', 502, 'GEOCODING_ERROR');
  }
}

/**
 * Reverse geocode lat/lng coordinates to an address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    const response = await axios.get(`${GOOGLE_MAPS_BASE}/geocode/json`, {
      params: {
        latlng: `${lat},${lng}`,
        key: getApiKey(),
      },
    });

    const data = response.data;
    if (data.status !== 'OK' || !data.results?.length) {
      throw new AppError(
        `Reverse geocoding failed: ${data.status} — ${data.error_message || 'No results found'}`,
        400,
        'REVERSE_GEOCODING_FAILED',
      );
    }

    const result = data.results[0];
    return {
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      addressComponents: result.address_components,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Reverse geocoding request failed', { error: error.message, lat, lng });
    throw new AppError('Reverse geocoding service unavailable', 502, 'REVERSE_GEOCODING_ERROR');
  }
}

/**
 * Get driving route between origin and destination using Google Directions API.
 * Returns distance, duration, and encoded polyline.
 */
export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RouteResult> {
  try {
    const response = await axios.get(`${GOOGLE_MAPS_BASE}/directions/json`, {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: 'driving',
        key: getApiKey(),
      },
    });

    const data = response.data;
    if (data.status !== 'OK' || !data.routes?.length) {
      throw new AppError(
        `Directions failed: ${data.status} — ${data.error_message || 'No route found'}`,
        400,
        'DIRECTIONS_FAILED',
      );
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(leg.duration.value / 60),
      polyline: route.overview_polyline.points,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Directions request failed', { error: error.message, origin, destination });
    throw new AppError('Directions service unavailable', 502, 'DIRECTIONS_ERROR');
  }
}

/**
 * Calculate driving distance and duration using Google Distance Matrix API.
 */
export async function calculateDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DistanceResult> {
  try {
    const response = await axios.get(`${GOOGLE_MAPS_BASE}/distancematrix/json`, {
      params: {
        origins: `${origin.lat},${origin.lng}`,
        destinations: `${destination.lat},${destination.lng}`,
        mode: 'driving',
        key: getApiKey(),
      },
    });

    const data = response.data;
    if (data.status !== 'OK') {
      throw new AppError(
        `Distance Matrix failed: ${data.status} — ${data.error_message || 'Request failed'}`,
        400,
        'DISTANCE_MATRIX_FAILED',
      );
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      throw new AppError(
        `Distance Matrix element error: ${element?.status || 'UNKNOWN'}`,
        400,
        'DISTANCE_MATRIX_FAILED',
      );
    }

    return {
      distanceKm: Math.round((element.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(element.duration.value / 60),
      originAddress: data.origin_addresses[0],
      destinationAddress: data.destination_addresses[0],
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Distance Matrix request failed', { error: error.message, origin, destination });
    throw new AppError('Distance Matrix service unavailable', 502, 'DISTANCE_MATRIX_ERROR');
  }
}

// ─── Directions API [Pickup → Drop] ─────────────────────────────────────────

/**
 * Get detailed step-by-step driving directions from pickup to drop location.
 * Uses Google Directions API with optional waypoints.
 */
export async function getDirections(
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number },
  waypoints?: Array<{ lat: number; lng: number }>,
): Promise<DirectionsResult> {
  try {
    const params: Record<string, string> = {
      origin: `${pickup.lat},${pickup.lng}`,
      destination: `${drop.lat},${drop.lng}`,
      mode: 'driving',
      departure_time: 'now',
      key: getApiKey(),
    };

    // Add optional waypoints if provided
    if (waypoints && waypoints.length > 0) {
      params.waypoints = waypoints.map((wp) => `${wp.lat},${wp.lng}`).join('|');
    }

    const response = await axios.get(`${GOOGLE_MAPS_BASE}/directions/json`, { params });

    const data = response.data;
    if (data.status !== 'OK' || !data.routes?.length) {
      throw new AppError(
        `Directions failed: ${data.status} — ${data.error_message || 'No route found'}`,
        400,
        'DIRECTIONS_FAILED',
      );
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Extract turn-by-turn steps
    const steps = (leg.steps ?? []).map((step: any) => ({
      instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
      distanceKm: Math.round((step.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(step.duration.value / 60),
    }));

    // Extract waypoint coordinates along the route
    const waypointCoords = (route.legs ?? []).map((l: any) => ({
      lat: l.start_location.lat,
      lng: l.start_location.lng,
    }));

    return {
      distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(leg.duration.value / 60),
      polyline: route.overview_polyline.points,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      steps,
      waypoints: waypointCoords,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Directions (Pickup → Drop) request failed', { error: error.message, pickup, drop });
    throw new AppError('Directions service unavailable', 502, 'DIRECTIONS_ERROR');
  }
}

// ─── Distance Matrix API [Finding Nearest Driver] ───────────────────────────

/**
 * Find the nearest driver from a list of driver locations to a rider's pickup point.
 * Uses Google Distance Matrix API with multiple origins (drivers) and one destination (rider).
 */
export async function findNearestDriver(
  drivers: Array<{ lat: number; lng: number }>,
  pickup: { lat: number; lng: number },
): Promise<DistanceMatrixResult> {
  try {
    if (!drivers.length) {
      throw new AppError('At least one driver location is required', 400, 'INVALID_DRIVER_LIST');
    }

    // Build pipe-separated origins from driver locations
    const origins = drivers.map((d) => `${d.lat},${d.lng}`).join('|');

    const response = await axios.get(`${GOOGLE_MAPS_BASE}/distancematrix/json`, {
      params: {
        origins,
        destinations: `${pickup.lat},${pickup.lng}`,
        mode: 'driving',
        departure_time: 'now',
        key: getApiKey(),
      },
    });

    const data = response.data;
    if (data.status !== 'OK') {
      throw new AppError(
        `Distance Matrix failed: ${data.status} — ${data.error_message || 'Request failed'}`,
        400,
        'DISTANCE_MATRIX_FAILED',
      );
    }

    // Parse each driver's distance/duration to the pickup point
    const rows = data.rows.map((row: any, index: number) => {
      const element = row.elements[0];
      return {
        driverLat: drivers[index].lat,
        driverLng: drivers[index].lng,
        distanceKm:
          element.status === 'OK'
            ? Math.round((element.distance.value / 1000) * 100) / 100
            : Infinity,
        durationMins:
          element.status === 'OK' ? Math.round(element.duration.value / 60) : Infinity,
      };
    });

    // Find the closest driver by distance
    const nearestDriver =
      rows.reduce(
        (best: any, row: any, idx: number) =>
          row.distanceKm < best.distanceKm ? { ...row, index: idx } : best,
        { distanceKm: Infinity, index: -1 },
      );

    return {
      rows,
      nearestDriver: nearestDriver.index >= 0 ? nearestDriver : null,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Find Nearest Driver request failed', { error: error.message, drivers, pickup });
    throw new AppError('Distance Matrix service unavailable', 502, 'DISTANCE_MATRIX_ERROR');
  }
}

// ─── Routes API [Traffic-Aware Routes] ──────────────────────────────────────

/**
 * Get traffic-aware routes using Google Routes API (v2).
 * Supports travel modes: DRIVE, TWO_WHEELER — ideal for ride-hailing & parcel delivery.
 */
export async function getTrafficAwareRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: 'DRIVE' | 'TWO_WHEELER' = 'DRIVE',
): Promise<TrafficAwareRouteResult[]> {
  try {
    const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    const body = {
      origin: {
        location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
      },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      travelMode,
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      computeAlternativeRoutes: true,
      extraComputations: ['TRAFFIC_ON_POLYLINE'],
    };

    const response = await axios.post(ROUTES_API_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getApiKey(),
        'X-Goog-FieldMask':
          'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.staticDuration,routes.travelAdvisory',
      },
    });

    const routes = response.data.routes;
    if (!routes?.length) {
      throw new AppError('No traffic-aware routes found', 400, 'ROUTES_NOT_FOUND');
    }

    // Parse each route alternative
    return routes.map((route: any) => ({
      distanceKm: Math.round((route.distanceMeters / 1000) * 100) / 100,
      durationMins: Math.round(parseInt(route.duration?.replace('s', '') || '0', 10) / 60),
      staticDurationMins: Math.round(
        parseInt(route.staticDuration?.replace('s', '') || '0', 10) / 60,
      ),
      polyline: route.polyline?.encodedPolyline || '',
      description: route.description || '',
      travelAdvisory: route.travelAdvisory || null,
    }));
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Routes API request failed', { error: error.message, origin, destination });
    throw new AppError('Routes service unavailable', 502, 'ROUTES_ERROR');
  }
}

// ─── Geolocation API [Backup Location Detection] ────────────────────────────

/**
 * Detect approximate device location using Google Geolocation API.
 * Used as a backup when GPS is unavailable or unreliable.
 * Accepts optional WiFi access points and cell tower info for better accuracy.
 */
export async function detectGeolocation(
  wifiAccessPoints?: Array<{ macAddress: string; signalStrength?: number }>,
  cellTowers?: Array<{
    cellId: number;
    locationAreaCode: number;
    mobileCountryCode: number;
    mobileNetworkCode: number;
  }>,
): Promise<GeolocationResult> {
  try {
    const GEOLOCATION_URL = `https://www.googleapis.com/geolocation/v1/geolocate?key=${getApiKey()}`;

    const body: Record<string, any> = {
      considerIp: true,
    };

    // Add WiFi access points if provided for better accuracy
    if (wifiAccessPoints && wifiAccessPoints.length > 0) {
      body.wifiAccessPoints = wifiAccessPoints;
    }

    // Add cell tower info if provided for better accuracy
    if (cellTowers && cellTowers.length > 0) {
      body.cellTowers = cellTowers;
    }

    const response = await axios.post(GEOLOCATION_URL, body, {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = response.data;
    if (!data.location) {
      throw new AppError('Geolocation failed: no location returned', 400, 'GEOLOCATION_FAILED');
    }

    return {
      lat: data.location.lat,
      lng: data.location.lng,
      accuracy: data.accuracy || 0,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Geolocation request failed', { error: error.message });
    throw new AppError('Geolocation service unavailable', 502, 'GEOLOCATION_ERROR');
  }
}

// ─── Route Optimization API [Optimizes multi-stop routes] ────────────────────

/**
 * Optimize the order of waypoints for the most efficient multi-stop route.
 * Uses Google Directions API with optimizeWaypoints=true.
 * Ideal for delivery routes with multiple drop-offs.
 */
export async function optimizeRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints: Array<{ lat: number; lng: number }>,
): Promise<OptimizedRouteResult> {
  try {
    if (!waypoints.length) {
      throw new AppError('At least one waypoint is required for route optimization', 400, 'INVALID_WAYPOINTS');
    }

    // Build pipe-separated waypoints with optimize flag
    const waypointStr = `optimize:true|${waypoints.map((wp) => `${wp.lat},${wp.lng}`).join('|')}`;

    const response = await axios.get(`${GOOGLE_MAPS_BASE}/directions/json`, {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        waypoints: waypointStr,
        mode: 'driving',
        departure_time: 'now',
        key: getApiKey(),
      },
    });

    const data = response.data;
    if (data.status !== 'OK' || !data.routes?.length) {
      throw new AppError(
        `Route optimization failed: ${data.status} — ${data.error_message || 'No route found'}`,
        400,
        'ROUTE_OPTIMIZATION_FAILED',
      );
    }

    const route = data.routes[0];
    const optimizedOrder: number[] = route.waypoint_order || [];

    // Parse each leg of the optimized route
    const legs = (route.legs ?? []).map((leg: any, idx: number) => ({
      legIndex: idx,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(leg.duration.value / 60),
    }));

    // Sum up totals
    const totalDistanceKm = legs.reduce((sum: number, l: any) => sum + l.distanceKm, 0);
    const totalDurationMins = legs.reduce((sum: number, l: any) => sum + l.durationMins, 0);

    return {
      optimizedWaypointOrder: optimizedOrder,
      routes: legs,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      totalDurationMins,
      polyline: route.overview_polyline.points,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Route optimization request failed', { error: error.message, origin, destination });
    throw new AppError('Route optimization service unavailable', 502, 'ROUTE_OPTIMIZATION_ERROR');
  }
}

// ─── Navigation SDK [Turn-by-Turn Navigation Data] ──────────────────────────

/**
 * Get turn-by-turn navigation data for driving between two points.
 * Returns granular step-level data with maneuvers, polylines, and bounds
 * suitable for rendering a navigation UI on the client.
 */
export async function getNavigationData(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<NavigationResult> {
  try {
    const response = await axios.get(`${GOOGLE_MAPS_BASE}/directions/json`, {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: 'driving',
        departure_time: 'now',
        key: getApiKey(),
      },
    });

    const data = response.data;
    if (data.status !== 'OK' || !data.routes?.length) {
      throw new AppError(
        `Navigation data failed: ${data.status} — ${data.error_message || 'No route found'}`,
        400,
        'NAVIGATION_FAILED',
      );
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Extract detailed step-level navigation data
    const steps: NavigationStep[] = (leg.steps ?? []).map((step: any) => ({
      instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
      distanceKm: Math.round((step.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(step.duration.value / 60),
      maneuver: step.maneuver || 'straight',
      startLocation: {
        lat: step.start_location.lat,
        lng: step.start_location.lng,
      },
      endLocation: {
        lat: step.end_location.lat,
        lng: step.end_location.lng,
      },
      polyline: step.polyline?.points || '',
    }));

    return {
      steps,
      totalDistanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
      totalDurationMins: Math.round(leg.duration.value / 60),
      overviewPolyline: route.overview_polyline.points,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      bounds: {
        northeast: {
          lat: route.bounds.northeast.lat,
          lng: route.bounds.northeast.lng,
        },
        southwest: {
          lat: route.bounds.southwest.lat,
          lng: route.bounds.southwest.lng,
        },
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Navigation data request failed', { error: error.message, origin, destination });
    throw new AppError('Navigation service unavailable', 502, 'NAVIGATION_ERROR');
  }
}

// ─── Maps Grounding Lite [AI-to-Maps Data Connection] ───────────────────────

/**
 * Search for places using a natural language text query.
 * Connects AI models to real Google Maps data via the Places Text Search (New) API.
 * Returns structured place data grounded in real-world locations.
 */
export async function searchPlacesGrounded(
  textQuery: string,
  locationBias?: { lat: number; lng: number; radiusMeters?: number },
): Promise<MapsGroundingResult> {
  try {
    const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';

    const body: Record<string, any> = {
      textQuery,
    };

    // Add location bias for proximity-based results
    if (locationBias) {
      body.locationBias = {
        circle: {
          center: {
            latitude: locationBias.lat,
            longitude: locationBias.lng,
          },
          radius: locationBias.radiusMeters || 5000,
        },
      };
    }

    const response = await axios.post(PLACES_API_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getApiKey(),
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.currentOpeningHours',
      },
    });

    const places = (response.data.places ?? []).map((place: any) => ({
      placeId: place.id || '',
      name: place.displayName?.text || '',
      formattedAddress: place.formattedAddress || '',
      lat: place.location?.latitude || 0,
      lng: place.location?.longitude || 0,
      types: place.types || [],
      rating: place.rating || undefined,
      openNow: place.currentOpeningHours?.openNow ?? undefined,
    }));

    return {
      places,
      attributions: ['Powered by Google Maps'],
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Maps Grounding search failed', { error: error.message, textQuery });
    throw new AppError('Maps Grounding service unavailable', 502, 'MAPS_GROUNDING_ERROR');
  }
}

// ─── Places Aggregate API [Nearby Place Search] ─────────────────────────────

/**
 * Search for nearby places by type (e.g. police stations, petrol bunks, hospitals).
 * Uses Google Places Nearby Search API to aggregate results around a location.
 */
export async function searchNearbyPlaces(
  location: { lat: number; lng: number },
  type: string,
  radiusMeters: number = 5000,
  keyword?: string,
): Promise<PlacesAggregateResult> {
  try {
    const params: Record<string, string | number> = {
      location: `${location.lat},${location.lng}`,
      radius: radiusMeters,
      type,
      key: getApiKey(),
    };

    // Add optional keyword filter for more specific results
    if (keyword) {
      params.keyword = keyword;
    }

    const response = await axios.get(`${GOOGLE_MAPS_BASE}/place/nearbysearch/json`, { params });

    const data = response.data;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new AppError(
        `Nearby search failed: ${data.status} — ${data.error_message || 'Unknown error'}`,
        400,
        'NEARBY_SEARCH_FAILED',
      );
    }

    // Parse and standardize place results
    const places = (data.results ?? []).map((place: any) => ({
      placeId: place.place_id || '',
      name: place.name || '',
      formattedAddress: place.formatted_address || '',
      lat: place.geometry?.location?.lat || 0,
      lng: place.geometry?.location?.lng || 0,
      types: place.types || [],
      rating: place.rating || undefined,
      userRatingsTotal: place.user_ratings_total || undefined,
      openNow: place.opening_hours?.open_now ?? undefined,
      vicinity: place.vicinity || '',
    }));

    return {
      places,
      totalResults: places.length,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Nearby places search failed', { error: error.message, location, type });
    throw new AppError('Nearby places service unavailable', 502, 'NEARBY_SEARCH_ERROR');
  }
}

// ─── Address Validation API [Correct Addresses] ─────────────────────────────

/**
 * Validate and correct an address using Google Address Validation API.
 * Returns the validated/corrected address, components, and a confidence verdict.
 */
export async function validateAddress(
  address: string,
  regionCode: string = 'IN',
): Promise<AddressValidationResult> {
  try {
    const ADDRESS_VALIDATION_URL =
      'https://addressvalidation.googleapis.com/v1:validateAddress';

    const body = {
      address: {
        addressLines: [address],
        regionCode,
      },
    };

    const response = await axios.post(`${ADDRESS_VALIDATION_URL}?key=${getApiKey()}`, body, {
      headers: { 'Content-Type': 'application/json' },
    });

    const result = response.data.result;
    if (!result) {
      throw new AppError(
        'Address validation returned no result',
        400,
        'ADDRESS_VALIDATION_FAILED',
      );
    }

    const geocode = result.geocode || {};
    const verdict = result.verdict || {};
    const addressObj = result.address || {};

    // Parse address components with confirmation status
    const addressComponents = (addressObj.addressComponents ?? []).map((comp: any) => ({
      componentName: comp.componentName?.text || '',
      componentType: comp.componentType || '',
      confirmed: comp.confirmationLevel === 'CONFIRMED',
    }));

    return {
      isValid: !verdict.hasUnconfirmedComponents && !verdict.hasReplacedComponents,
      formattedAddress: addressObj.formattedAddress || '',
      addressComponents,
      lat: geocode.location?.latitude || 0,
      lng: geocode.location?.longitude || 0,
      verdict: {
        inputGranularity: verdict.inputGranularity || 'UNKNOWN',
        validationGranularity: verdict.validationGranularity || 'UNKNOWN',
        hasUnconfirmedComponents: verdict.hasUnconfirmedComponents || false,
        hasInferredComponents: verdict.hasInferredComponents || false,
        hasReplacedComponents: verdict.hasReplacedComponents || false,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Address validation request failed', { error: error.message, address });
    throw new AppError('Address validation service unavailable', 502, 'ADDRESS_VALIDATION_ERROR');
  }
}


