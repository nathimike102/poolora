/**
 * OsmMapsService.ts
 *
 * Free, keyless stand-ins for the Google calls the ride flow depends on,
 * built on OpenStreetMap data:
 * - Photon (komoot) for place suggestions
 * - Nominatim for geocoding and reverse geocoding
 * - OSRM for driving routes and distances
 *
 * Results have the same shape as the Google versions in MapsService, so
 * callers do not care which provider answered. OSRM returns polylines in the
 * same encoding Google uses (precision 5).
 */

import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import type {
  AutocompleteResult,
  DistanceResult,
  GeocodeResult,
  ReverseGeocodeResult,
  RouteResult,
} from './MapsService';

/** Rough box around India, matching the Google calls' country:in restriction. */
const INDIA_BBOX = '68.1,6.5,97.4,35.7';
const COUNTRY_CODE = 'in';

const CACHE_TTL = {
  autocomplete: 10 * 60,
  geocode: 24 * 60 * 60,
  route: 10 * 60,
};

/**
 * GET with a Redis cache. Public OSM servers are rate limited (Nominatim
 * allows one request a second), so caching matters more here than for Google.
 */
async function cachedGet<T>(url: string, params: Record<string, string>, ttlSeconds: number): Promise<T> {
  const redis = getRedisClient();
  const cacheKey = `maps:osm:${crypto
    .createHash('sha1')
    .update(url + JSON.stringify(Object.entries(params).sort()))
    .digest('hex')}`;

  if (redis) {
    try {
      const hit = await redis.get(cacheKey);
      if (hit) return JSON.parse(hit) as T;
    } catch (error) {
      logger.warn('Maps cache read failed', { error: errorMessage(error) });
    }
  }

  const response = await axios.get<T>(url, {
    params,
    timeout: 10000,
    headers: { 'User-Agent': config.maps.osmUserAgent, 'Accept-Language': 'en' },
  });

  if (redis) {
    redis.setex(cacheKey, ttlSeconds, JSON.stringify(response.data)).catch((error: Error) => {
      logger.warn('Maps cache write failed', { error: errorMessage(error) });
    });
  }
  return response.data;
}

function unavailable(action: string, error: unknown, code: string): AppError {
  logger.error(`${action} request failed (OSM)`, { error: errorMessage(error) });
  return new AppError('Maps are unavailable right now. Please try again in a moment.', 502, code);
}

// ─── Photon: suggestions ─────────────────────────────────────────────────────

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
  };
}

function photonTitle(p: PhotonFeature['properties']): string {
  if (p.name) return p.name;
  return [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || p.state || '';
}

function photonSubtitle(p: PhotonFeature['properties'], title: string): string {
  const parts = [p.district ?? p.locality, p.city ?? p.county, p.state]
    .filter((part): part is string => Boolean(part) && part !== title);
  return [...new Set(parts)].join(', ');
}

export async function autocomplete(input: string, near?: { lat: number; lng: number }): Promise<AutocompleteResult[]> {
  let data: { features?: PhotonFeature[] };
  try {
    data = await cachedGet(
      `${config.maps.photonUrl}/api/`,
      {
        q: input.trim().toLowerCase(),
        limit: '10',
        bbox: INDIA_BBOX,
        lang: 'en',
        // Photon ranks places near this point higher
        ...(near ? { lat: String(near.lat), lon: String(near.lng) } : {}),
      },
      CACHE_TTL.autocomplete,
    );
  } catch (error) {
    throw unavailable('Autocomplete', error, 'AUTOCOMPLETE_ERROR');
  }

  const seen = new Set<string>();
  const results: AutocompleteResult[] = [];
  for (const feature of data.features ?? []) {
    const p = feature.properties;
    if (p.countrycode && p.countrycode.toLowerCase() !== COUNTRY_CODE) continue;
    const mainText = photonTitle(p);
    if (!mainText) continue;
    const secondaryText = photonSubtitle(p, mainText);
    const description = secondaryText ? `${mainText}, ${secondaryText}` : mainText;
    // Photon often returns the same place as a node and a way
    if (seen.has(description)) continue;
    seen.add(description);
    results.push({
      description,
      placeId: `osm:${p.osm_type ?? ''}${p.osm_id ?? ''}`,
      mainText,
      secondaryText,
    });
    if (results.length === 5) break;
  }
  return results;
}

// ─── Nominatim: addresses ────────────────────────────────────────────────────

interface NominatimPlace {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  display_name?: string;
  address?: Record<string, string>;
}

function nominatimPlaceId(place: NominatimPlace): string {
  return place.osm_type && place.osm_id
    ? `osm:${place.osm_type[0].toUpperCase()}${place.osm_id}`
    : `osm:${place.place_id ?? ''}`;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  let places: NominatimPlace[];
  try {
    places = await cachedGet(
      `${config.maps.nominatimUrl}/search`,
      { q: address, format: 'jsonv2', countrycodes: COUNTRY_CODE, limit: '1' },
      CACHE_TTL.geocode,
    );
  } catch (error) {
    throw unavailable('Geocoding', error, 'GEOCODING_ERROR');
  }

  const place = places[0];
  if (place) {
    return {
      formattedAddress: place.display_name ?? address,
      lat: Number(place.lat),
      lng: Number(place.lon),
      placeId: nominatimPlaceId(place),
    };
  }

  // Nominatim needs every word to match, which the labels of shops and other
  // places often do not. Photon's fuzzy search still lands on or near them.
  const nearest = await photonFirstMatch(address);
  if (!nearest) throw new AppError('We could not find that address.', 400, 'GEOCODING_FAILED');
  return nearest;
}

async function photonFirstMatch(address: string): Promise<GeocodeResult | null> {
  let data: { features?: PhotonFeature[] };
  try {
    data = await cachedGet(
      `${config.maps.photonUrl}/api/`,
      { q: address, limit: '5', bbox: INDIA_BBOX, lang: 'en' },
      CACHE_TTL.geocode,
    );
  } catch (error) {
    throw unavailable('Geocoding', error, 'GEOCODING_ERROR');
  }
  const feature = (data.features ?? []).find(
    (f) => !f.properties.countrycode || f.properties.countrycode.toLowerCase() === COUNTRY_CODE,
  );
  if (!feature) return null;
  const [lng, lat] = feature.geometry.coordinates;
  return {
    formattedAddress: address,
    lat,
    lng,
    placeId: `osm:${feature.properties.osm_type ?? ''}${feature.properties.osm_id ?? ''}`,
  };
}

/** Nominatim address keys mapped onto the closest Google component types. */
const COMPONENT_TYPES: Record<string, string[]> = {
  house_number: ['street_number'],
  road: ['route'],
  neighbourhood: ['neighborhood', 'political'],
  suburb: ['sublocality', 'political'],
  city: ['locality', 'political'],
  town: ['locality', 'political'],
  village: ['locality', 'political'],
  county: ['administrative_area_level_2', 'political'],
  state_district: ['administrative_area_level_2', 'political'],
  state: ['administrative_area_level_1', 'political'],
  postcode: ['postal_code'],
  country: ['country', 'political'],
};

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  let place: NominatimPlace & { error?: string };
  try {
    place = await cachedGet(
      `${config.maps.nominatimUrl}/reverse`,
      { lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', zoom: '18' },
      CACHE_TTL.geocode,
    );
  } catch (error) {
    throw unavailable('Reverse geocoding', error, 'REVERSE_GEOCODING_ERROR');
  }

  if (place.error || !place.display_name) {
    throw new AppError('We could not find an address for that spot.', 400, 'REVERSE_GEOCODING_FAILED');
  }

  const address = place.address ?? {};
  return {
    formattedAddress: place.display_name,
    placeId: nominatimPlaceId(place),
    addressComponents: Object.entries(address)
      .filter(([key]) => COMPONENT_TYPES[key])
      .map(([key, value]) => ({
        long_name: value,
        short_name: key === 'country' ? (address.country_code ?? value).toUpperCase() : value,
        types: COMPONENT_TYPES[key],
      })),
  };
}

// ─── OSRM: routes ────────────────────────────────────────────────────────────

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: Array<{ distance: number; duration: number; geometry: string }>;
  waypoints?: Array<{ name?: string }>;
}

async function osrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }> = [],
): Promise<OsrmResponse> {
  let data: OsrmResponse;
  const coordinates = [origin, ...stops, destination].map((p) => `${p.lng},${p.lat}`).join(';');
  try {
    data = await cachedGet(
      `${config.maps.osrmUrl}/route/v1/driving/${coordinates}`,
      { overview: 'full', geometries: 'polyline' },
      CACHE_TTL.route,
    );
  } catch (error) {
    // OSRM answers 400 with a code such as NoRoute for unroutable pairs
    const body = axios.isAxiosError(error) ? (error.response?.data as OsrmResponse | undefined) : undefined;
    if (body?.code) data = body;
    else throw unavailable('Directions', error, 'DIRECTIONS_ERROR');
  }

  if (data.code !== 'Ok' || !data.routes?.length) {
    logger.warn('OSRM found no route', { code: data.code, message: data.message });
    throw new AppError('We could not find a route between those places.', 400, 'DIRECTIONS_FAILED');
  }
  return data;
}

/** Driving route from origin to destination, through `stops` in order */
export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }> = [],
): Promise<RouteResult> {
  const data = await osrmRoute(origin, destination, stops);
  const route = data.routes![0];
  return {
    distanceKm: Math.round((route.distance / 1000) * 100) / 100,
    durationMins: Math.round(route.duration / 60),
    polyline: route.geometry,
    startAddress: data.waypoints?.[0]?.name ?? '',
    endAddress: data.waypoints?.[data.waypoints.length - 1]?.name ?? '',
  };
}

export async function calculateDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DistanceResult> {
  const route = await getRoute(origin, destination);
  return {
    distanceKm: route.distanceKm,
    durationMins: route.durationMins,
    originAddress: route.startAddress,
    destinationAddress: route.endAddress,
  };
}
