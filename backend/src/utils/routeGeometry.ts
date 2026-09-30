/**
 * routeGeometry.ts
 *
 * Helpers for walking a driving route: decode the stored polyline, measure it
 * and split it into evenly spaced positions.
 */

import { haversineDistanceKm } from './helpers';

export type LatLng = { lat: number; lng: number };

/** Decode a Google-encoded polyline (OSRM uses the same format). */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Encode positions as a Google polyline (the inverse of decodePolyline). */
export function encodePolyline(path: LatLng[]): string {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  const encode = (delta: number) => {
    let value = delta < 0 ? ~(delta << 1) : delta << 1;
    while (value >= 0x20) {
      out += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    out += String.fromCharCode(value + 63);
  };
  for (const p of path) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    encode(lat - prevLat);
    encode(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

/** True when every position is a real place on Earth */
export function isValidPath(path: LatLng[]): boolean {
  return path.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
}

/** Evenly spaced positions along a path, `steps` intervals long. */
export function resample(path: LatLng[], steps: number): LatLng[] {
  if (path.length < 2) return path.slice();
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) {
    cumulative.push(
      cumulative[i - 1] + haversineDistanceKm(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng),
    );
  }
  const total = cumulative[cumulative.length - 1];
  const out: LatLng[] = [];
  let segment = 1;
  for (let s = 0; s <= steps; s++) {
    const target = (total * s) / steps;
    while (segment < path.length - 1 && cumulative[segment] < target) segment++;
    const span = cumulative[segment] - cumulative[segment - 1];
    const t = span > 0 ? (target - cumulative[segment - 1]) / span : 1;
    const a = path[segment - 1];
    const b = path[segment];
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return out;
}

export function pathLengthKm(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineDistanceKm(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
  }
  return total;
}

/** Compass bearing from a to b, in degrees clockwise from north. */
export function bearing(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * The point on a path closest to `point`: how far away it is, and how far
 * along the path it lies (both in km). Uses a flat projection around the
 * point, accurate to well under 1% at the few-km scale this is used for.
 */
export function nearestOnPath(point: LatLng, path: LatLng[]): { distanceKm: number; alongKm: number } {
  if (path.length === 0) return { distanceKm: Infinity, alongKm: 0 };
  if (path.length === 1) {
    return { distanceKm: haversineDistanceKm(point.lat, point.lng, path[0].lat, path[0].lng), alongKm: 0 };
  }
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((point.lat * Math.PI) / 180);
  const toXY = (p: LatLng) => ({ x: (p.lng - point.lng) * kmPerDegLng, y: (p.lat - point.lat) * kmPerDegLat });
  let best = { distanceKm: Infinity, alongKm: 0 };
  let travelled = 0;
  for (let i = 1; i < path.length; i++) {
    const a = toXY(path[i - 1]);
    const b = toXY(path[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lenSq)) : 0;
    const d = Math.hypot(a.x + t * dx, a.y + t * dy);
    const segKm = Math.sqrt(lenSq);
    if (d < best.distanceKm) best = { distanceKm: d, alongKm: travelled + t * segKm };
    travelled += segKm;
  }
  return best;
}

/** Shortest distance in km from a point to a path. */
export function distanceToPathKm(point: LatLng, path: LatLng[]): number {
  return nearestOnPath(point, path).distanceKm;
}

/**
 * A route as a GeoJSON LineString for a 2dsphere index. Points closer than
 * `minSpacingKm` to the last kept one are dropped, which keeps long routes to
 * a few thousand points without changing their shape at search scale.
 * Returns null when fewer than two distinct points remain.
 */
export function toLineString(
  path: LatLng[],
  minSpacingKm = 0.1,
): { type: 'LineString'; coordinates: [number, number][] } | null {
  if (path.length < 2) return null;
  const spacing = Math.max(minSpacingKm, pathLengthKm(path) / 3000);
  const kept: LatLng[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const last = kept[kept.length - 1];
    const isEnd = i === path.length - 1;
    const d = haversineDistanceKm(last.lat, last.lng, path[i].lat, path[i].lng);
    if (d >= spacing || (isEnd && d > 0)) kept.push(path[i]);
  }
  if (kept.length < 2) return null;
  return { type: 'LineString', coordinates: kept.map((p) => [p.lng, p.lat]) };
}
