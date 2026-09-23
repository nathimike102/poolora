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
