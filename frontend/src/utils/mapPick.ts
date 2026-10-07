/**
 * utils/mapPick.ts
 *
 * Lets any form ask for a point on the map and wait for it: the map picker
 * resolves the request and goes back, so the form keeps everything else it
 * had filled in. Backing out of the map resolves nothing; the form keeps its
 * text.
 */
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import { rememberExactPlace } from '../services/placesService';

export interface PickedPoint {
  address: string;
  lat: number;
  lng: number;
}

const waiting = new Map<string, (point: PickedPoint) => void>();
let next = 0;

export function pickOnMap(
  navigation: NavigationProp<ParamListBase>,
  field: 'from' | 'to',
  onPicked: (point: PickedPoint) => void,
): void {
  const requestId = `pick-${++next}`;
  // Only the latest request is live: an older map screen left open resolves nothing
  waiting.clear();
  waiting.set(requestId, onPicked);
  navigation.navigate('MapPicker', { field, requestId });
}

export function resolveMapPick(requestId: string, point: PickedPoint): void {
  const done = waiting.get(requestId);
  waiting.delete(requestId);
  if (!done) return;
  // The pinned point itself, not a lookup of its address, when the form submits
  rememberExactPlace(point.address, point.lat, point.lng);
  done(point);
}
