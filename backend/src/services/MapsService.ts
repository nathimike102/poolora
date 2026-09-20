import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import type {
  AddressComponentV1,
  AddressValidationResponse,
  AutocompleteResponse,
  DirectionsResponse,
  DistanceMatrixResponse,
  GeocodeResponse,
  GeolocationResponse,
  NearbySearchResponse,
  PlacesV1Response,
  RoutesApiResponse,
  ComputedRoute,
  DirectionsLeg,
  DirectionsStep,
  DistanceMatrixRow,
  DriverDistance,
  GeolocationRequestBody,
  PlaceLegacy,
  PlacePrediction,
  PlaceV1,
} from '../types/googleMaps';

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

/**
 * GET a Google Maps web service with a short-lived Redis cache. Only successful
 * responses are cached, the API key is excluded from the cache key, and TTLs
 * stay well inside Google's temporary-caching allowance.
 */
async function cachedMapsGet<T>(
  url: string,
  params: Record<string, string>,
  ttlSeconds: number,
): Promise<{ data: T }> {
  const redis = getRedisClient();
  const cacheKey = `maps:${crypto
    .createHash('sha1')
    .update(url + JSON.stringify(Object.entries(params).sort()))
    .digest('hex')}`;

  if (redis) {
    try {
      const hit = await redis.get(cacheKey);
      if (hit) return { data: JSON.parse(hit) };
    } catch (error) {
      logger.warn('Maps cache read failed', { error: (error as Error).message });
    }
  }

  const response = await axios.get(url, { params: { ...params, key: getApiKey() }, timeout: 10000 });

  if (redis && (response.data?.status === 'OK' || response.data?.status === 'ZERO_RESULTS')) {
    redis.setex(cacheKey, ttlSeconds, JSON.stringify(response.data)).catch((error: Error) => {
      logger.warn('Maps cache write failed', { error: errorMessage(error) });
    });
  }
  return response;
}

const CACHE_TTL = {
  autocomplete: 10 * 60,
  geocode: 24 * 60 * 60,
  route: 10 * 60,
};

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
  mainText: string;
  secondaryText: string;
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
  travelAdvisory: ComputedRoute['travelAdvisory'];
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
    const response = await cachedMapsGet<AutocompleteResponse>(
      `${GOOGLE_MAPS_BASE}/place/autocomplete/json`,
      { input: input.trim().toLowerCase(), components: 'country:in' },
      CACHE_TTL.autocomplete,
    );

    const data = response.data;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new AppError(
        `Autocomplete failed: ${data.status} — ${data.error_message || 'Unknown error'}`,
        400,
        'AUTOCOMPLETE_FAILED',
      );
    }

    return (data.predictions ?? []).slice(0, 5).map((p: PlacePrediction) => ({
      description: p.description,
      placeId: p.place_id,
      mainText: p.structured_formatting?.main_text ?? p.description,
      secondaryText: p.structured_formatting?.secondary_text ?? '',
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Autocomplete request failed', { error: errorMessage(error) });
    throw new AppError('Autocomplete service unavailable', 502, 'AUTOCOMPLETE_ERROR');
  }
}

/**
 * Geocode an address string to lat/lng coordinates.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  try {
    const response = await cachedMapsGet<GeocodeResponse>(
      `${GOOGLE_MAPS_BASE}/geocode/json`,
      { address },
      CACHE_TTL.geocode,
    );

    const data = response.data;
    if (data.status !== 'OK' || !data.results?.length) {
      throw new AppError(
        `Geocoding failed: ${data.status} — ${data.error_message || 'No results found'}`,
        400,
        'GEOCODING_FAILED',
      );
    }

    const result = data.results[0];
    const location = result.geometry?.location;
    if (!location || result.formatted_address === undefined || result.place_id === undefined) {
      // Google answered OK but left out what a coordinate is for.
      throw new AppError('Geocoding returned an incomplete result', 502, 'GEOCODING_FAILED');
    }

    return {
      formattedAddress: result.formatted_address,
      lat: location.lat,
      lng: location.lng,
      placeId: result.place_id,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Geocoding request failed', { error: errorMessage(error), address });
    throw new AppError('Geocoding service unavailable', 502, 'GEOCODING_ERROR');
  }
}

/**
 * Reverse geocode lat/lng coordinates to an address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    const response = await cachedMapsGet<GeocodeResponse>(
      `${GOOGLE_MAPS_BASE}/geocode/json`,
      { latlng: `${lat},${lng}` },
      CACHE_TTL.geocode,
    );

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
      formattedAddress: result.formatted_address ?? '',
      placeId: result.place_id ?? '',
      addressComponents: (result.address_components ?? []).map(component => ({
        long_name: component.long_name ?? '',
        short_name: component.short_name ?? '',
        types: component.types ?? [],
      })),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Reverse geocoding request failed', { error: errorMessage(error), lat, lng });
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
    const response = await cachedMapsGet<DirectionsResponse>(
      `${GOOGLE_MAPS_BASE}/directions/json`,
      {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: 'driving',
      },
      CACHE_TTL.route,
    );

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
      polyline: route.overview_polyline?.points ?? '',
      startAddress: leg.start_address,
      endAddress: leg.end_address,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Directions request failed', { error: errorMessage(error), origin, destination });
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
    const response = await cachedMapsGet<DistanceMatrixResponse>(
      `${GOOGLE_MAPS_BASE}/distancematrix/json`,
      {
        origins: `${origin.lat},${origin.lng}`,
        destinations: `${destination.lat},${destination.lng}`,
        mode: 'driving',
      },
      CACHE_TTL.route,
    );

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

    if (!element.distance || !element.duration) {
      throw new AppError('Distance Matrix returned no distance', 502, 'DISTANCE_MATRIX_FAILED');
    }

    return {
      distanceKm: Math.round((element.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(element.duration.value / 60),
      originAddress: data.origin_addresses?.[0] ?? '',
      destinationAddress: data.destination_addresses?.[0] ?? '',
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Distance Matrix request failed', { error: errorMessage(error), origin, destination });
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

    const response = await axios.get<DirectionsResponse>(`${GOOGLE_MAPS_BASE}/directions/json`, { params });

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
    const steps = (leg.steps ?? []).map((step: DirectionsStep) => ({
      instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
      distanceKm: Math.round((step.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(step.duration.value / 60),
    }));

    // Extract waypoint coordinates along the route
    const waypointCoords = (route.legs ?? []).map((l: DirectionsLeg) => ({
      lat: l.start_location.lat,
      lng: l.start_location.lng,
    }));

    return {
      distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(leg.duration.value / 60),
      polyline: route.overview_polyline?.points ?? '',
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      steps,
      waypoints: waypointCoords,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Directions (Pickup → Drop) request failed', { error: errorMessage(error), pickup, drop });
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

    const response = await axios.get<DistanceMatrixResponse>(`${GOOGLE_MAPS_BASE}/distancematrix/json`, {
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
    const rows: DriverDistance[] = (data.rows ?? []).map((row: DistanceMatrixRow, index: number) => {
      const element = row.elements[0];
      const routable =
        element?.status === 'OK' && element.distance !== undefined && element.duration !== undefined;

      // A driver Google cannot route to sorts last rather than breaking the call.
      return {
        driverLat: drivers[index].lat,
        driverLng: drivers[index].lng,
        distanceKm: routable ? Math.round((element.distance!.value / 1000) * 100) / 100 : Infinity,
        durationMins: routable ? Math.round(element.duration!.value / 60) : Infinity,
      };
    });

    // Find the closest driver by distance
    const nearestDriver =
      rows.reduce(
        (best: DriverDistance & { index: number }, row: DriverDistance, idx: number) =>
          row.distanceKm < best.distanceKm ? { ...row, index: idx } : best,
        { driverLat: 0, driverLng: 0, distanceKm: Infinity, durationMins: Infinity, index: -1 },
      );

    return {
      rows,
      nearestDriver: nearestDriver.index >= 0 ? nearestDriver : null,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Find Nearest Driver request failed', { error: errorMessage(error), drivers, pickup });
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

    const response = await axios.post<RoutesApiResponse>(ROUTES_API_URL, body, {
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
    return routes.map((route: ComputedRoute) => ({
      distanceKm: Math.round(((route.distanceMeters ?? 0) / 1000) * 100) / 100,
      durationMins: Math.round(parseInt(route.duration?.replace('s', '') || '0', 10) / 60),
      staticDurationMins: Math.round(
        parseInt(route.staticDuration?.replace('s', '') || '0', 10) / 60,
      ),
      polyline: route.polyline?.encodedPolyline || '',
      description: route.description || '',
      travelAdvisory: route.travelAdvisory,
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Routes API request failed', { error: errorMessage(error), origin, destination });
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

    const body: GeolocationRequestBody = {
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

    const response = await axios.post<GeolocationResponse>(GEOLOCATION_URL, body, {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = response.data;
    if (!data.location) {
      throw new AppError('Geolocation failed: no location returned', 400, 'GEOLOCATION_FAILED');
    }

    const { lat, lng } = data.location;
    if (lat === undefined || lng === undefined) {
      throw new AppError('Geolocation failed: no location returned', 400, 'GEOLOCATION_FAILED');
    }

    return {
      lat,
      lng,
      accuracy: data.accuracy ?? 0,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Geolocation request failed', { error: errorMessage(error) });
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

    const response = await axios.get<DirectionsResponse>(`${GOOGLE_MAPS_BASE}/directions/json`, {
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
    const legs = (route.legs ?? []).map((leg: DirectionsLeg, idx: number) => ({
      legIndex: idx,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
      durationMins: Math.round(leg.duration.value / 60),
    }));

    // Sum up totals
    const totalDistanceKm = legs.reduce((sum: number, l: { distanceKm: number; durationMins: number }) => sum + l.distanceKm, 0);
    const totalDurationMins = legs.reduce((sum: number, l: { distanceKm: number; durationMins: number }) => sum + l.durationMins, 0);

    return {
      optimizedWaypointOrder: optimizedOrder,
      routes: legs,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      totalDurationMins,
      polyline: route.overview_polyline?.points ?? '',
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Route optimization request failed', { error: errorMessage(error), origin, destination });
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
    const response = await axios.get<DirectionsResponse>(`${GOOGLE_MAPS_BASE}/directions/json`, {
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
    const steps: NavigationStep[] = (leg.steps ?? []).map((step: DirectionsStep) => ({
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
      overviewPolyline: route.overview_polyline?.points ?? '',
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      // Google omits bounds on some responses; fall back to the leg endpoints.
      bounds: {
        northeast: route.bounds?.northeast ?? leg.end_location,
        southwest: route.bounds?.southwest ?? leg.start_location,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Navigation data request failed', { error: errorMessage(error), origin, destination });
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

    const body: Record<string, unknown> = {
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

    const response = await axios.post<PlacesV1Response>(PLACES_API_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getApiKey(),
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.currentOpeningHours',
      },
    });

    const places = (response.data.places ?? []).map((place: PlaceV1) => ({
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
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Maps Grounding search failed', { error: errorMessage(error), textQuery });
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

    const response = await axios.get<NearbySearchResponse>(`${GOOGLE_MAPS_BASE}/place/nearbysearch/json`, { params });

    const data = response.data;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new AppError(
        `Nearby search failed: ${data.status} — ${data.error_message || 'Unknown error'}`,
        400,
        'NEARBY_SEARCH_FAILED',
      );
    }

    // Parse and standardize place results
    const places = (data.results ?? []).map((place: PlaceLegacy) => ({
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
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Nearby places search failed', { error: errorMessage(error), location, type });
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

    const response = await axios.post<AddressValidationResponse>(`${ADDRESS_VALIDATION_URL}?key=${getApiKey()}`, body, {
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
    const addressComponents = (addressObj.addressComponents ?? []).map((comp: AddressComponentV1) => ({
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
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Address validation request failed', { error: errorMessage(error), address });
    throw new AppError('Address validation service unavailable', 502, 'ADDRESS_VALIDATION_ERROR');
  }
}


