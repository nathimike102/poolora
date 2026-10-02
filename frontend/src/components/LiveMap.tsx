/**
 * components/LiveMap.tsx
 *
 * Map for ride routes and live driver position, drawn with MapLibre on free
 * OpenFreeMap tiles (OpenStreetMap data, no API key).
 *
 * Features:
 * - Requests user location permission and centres map automatically
 * - Shows origin (teal) / destination (red) markers joined by the road route
 *   when one is given, or by a dashed straight line otherwise
 * - Shows a driver marker only when a real driver location is provided
 * - Follows the phone's light/dark setting
 * - Centres on the market's centre (Harare) if the user's location is unavailable
 *
 * Nothing is drawn from placeholder data: without coordinates the map just
 * shows the user's area.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import {
  Map as MapLibreMap,
  Camera,
  Marker,
  GeoJSONSource,
  Layer,
  NativeUserLocation,
  type CameraRef,
  type LngLat,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';

import { useApp } from '../context/AppContext';
import { MAPS_ENABLED, MAP_STYLE } from '../config/maps';
import { Icon } from './Icon';
import { MapPlaceholder } from './MapPlaceholder';
import { REGION } from '../utils/region';
import { useTranslation } from 'react-i18next';

type Coordinate = { latitude: number; longitude: number };

/* ── Props ─────────────────────────────────────────────────────── */
interface LiveMapProps {
  showRoute?: boolean;
  showDriver?: boolean;
  style?: ViewStyle;
  /** Override the initial map centre */
  initialRegion?: Coordinate;
  /** Origin coordinate for the route line */
  origin?: Coordinate;
  /** Destination coordinate for the route line */
  destination?: Coordinate;
  /** Road route between origin and destination; a straight dashed line is drawn without it */
  route?: Coordinate[];
  /** Driver coordinate (only used when showDriver is true) */
  driverLocation?: Coordinate;
}

/* ── Fallback camera centre (the market's, Harare) ──────────────── */
const DEFAULT_CENTER: Coordinate = REGION.center;
const DEFAULT_ZOOM = 13;
const FIT_PADDING = { top: 60, right: 60, bottom: 60, left: 60 };

const toLngLat = (c: Coordinate): LngLat => [c.longitude, c.latitude];

/* ── Component ───────────────────────────────────────────────────── */
export function LiveMap(props: LiveMapProps) {
  if (!MAPS_ENABLED) {
    return <MapPlaceholder style={[styles.container, props.style]} />;
  }
  return <OpenLiveMap {...props} />;
}

function OpenLiveMap({
  showRoute = false,
  showDriver = false,
  style,
  initialRegion,
  origin,
  destination,
  route,
  driverLocation,
}: LiveMapProps) {
  const { isDarkMode, c } = useApp();
  const { t } = useTranslation();
  const cameraRef = useRef<CameraRef>(null);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [loading, setLoading] = useState(true);

  const canShowRoute = showRoute && Boolean(origin && destination);
  const canShowDriver = showDriver && Boolean(driverLocation);

  /* ── Request location permission & get user position ──────────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          if (mounted) setLocationGranted(true);
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (mounted) {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        }
      } catch {
        // Silently fall back to default region
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ── Route geometry ───────────────────────────────────────────── */
  // Keyed on the coordinates, not the objects, which callers rebuild on every render
  const routeKey = canShowRoute && origin && destination
    ? [origin, destination, ...(route ?? [])].map(p => `${p.latitude},${p.longitude}`).join(';')
    : '';
  const routeLine = useMemo(() => {
    if (!routeKey || !origin || !destination) return null;
    const path = route && route.length >= 2 ? route : [origin, destination];
    return {
      roadRoute: path.length > 2,
      feature: {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: path.map(toLngLat) },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  /* ── Fit the route (and the driver when they appear) into view ─── */
  useEffect(() => {
    if (loading || !routeLine) return;
    const coords = routeLine.feature.geometry.coordinates.slice();
    if (canShowDriver && driverLocation) coords.push(toLngLat(driverLocation));
    const lngs = coords.map(p => p[0]);
    const lats = coords.map(p => p[1]);

    // Small delay to let the map fully mount
    const timer = setTimeout(() => {
      cameraRef.current?.fitBounds(
        [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: FIT_PADDING, duration: 600 },
      );
    }, 500);
    return () => clearTimeout(timer);
    // Refit when the driver first appears, not on every position update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, routeLine, canShowDriver]);

  /* ── Where the camera starts ──────────────────────────────────── */
  const center = initialRegion ?? origin ?? userLocation ?? DEFAULT_CENTER;

  return (
    <View testID="live-map" style={[styles.container, style]}>
      {loading ? (
        <View style={[styles.loader, { backgroundColor: isDarkMode ? '#1A1E2E' : '#EEF2F8' }]}>
          <ActivityIndicator testID="map-loader" size="large" color={c.primary} />
        </View>
      ) : (
        <MapLibreMap
          testID="live-map-view"
          style={StyleSheet.absoluteFill}
          mapStyle={isDarkMode ? MAP_STYLE.dark : MAP_STYLE.light}
          logo={false}
          compass={false}
          attributionPosition={{ bottom: 8, left: 8 }}
        >
          <Camera
            ref={cameraRef}
            initialViewState={{ center: toLngLat(center), zoom: DEFAULT_ZOOM }}
          />

          {locationGranted && <NativeUserLocation />}

          {/* ── Route line ────────────────────────────────────── */}
          {routeLine && (
            <GeoJSONSource id="ride-route" data={routeLine.feature}>
              <Layer
                id="ride-route-line"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': c.primary,
                  'line-width': routeLine.roadRoute ? 5 : 3,
                  // Dashed when it only shows the direction, not the road route
                  ...(routeLine.roadRoute ? {} : { 'line-dasharray': [2, 1.5] }),
                }}
              />
            </GeoJSONSource>
          )}

          {canShowRoute && origin && destination && (
            <>
              {/* Origin marker */}
              <Marker id="origin" lngLat={toLngLat(origin)} anchor="center">
                <View style={styles.originMarkerOuter}>
                  <View style={styles.originMarkerInner} />
                </View>
              </Marker>
              {/* Destination marker */}
              <Marker id="destination" lngLat={toLngLat(destination)} anchor="center">
                <View style={styles.destMarkerOuter}>
                  <View style={styles.destMarkerInner} />
                </View>
              </Marker>
            </>
          )}

          {/* ── Driver marker ─────────────────────────────────── */}
          {canShowDriver && driverLocation && (
            <Marker id="driver" lngLat={toLngLat(driverLocation)} anchor="center">
              <View style={styles.driverMarkerOuter} accessibilityLabel={t('liveMap.driver')}>
                <View style={styles.driverMarkerInner}>
                  <Icon name="car" size={20} color="#FFFFFF" />
                </View>
              </View>
            </Marker>
          )}
        </MapLibreMap>
      )}
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  loader: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Origin marker, teal ring
  originMarkerOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0B7A75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  originMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },

  // Destination marker — red ring
  destMarkerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },

  // Driver marker, teal circle
  driverMarkerOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  driverMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0B7A75',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
