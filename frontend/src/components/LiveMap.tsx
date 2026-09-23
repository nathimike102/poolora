/**
 * components/LiveMap.tsx
 *
 * Real map component powered by react-native-maps + expo-location.
 * Map used for ride routes and live driver position.
 *
 * Features:
 * - Requests user location permission and centres map automatically
 * - Shows origin (teal) / destination (red) markers joined by a dashed line
 *   when showRoute is true and both coordinates are known
 * - Shows a driver marker only when a real driver location is provided
 * - Supports dark mode via custom map styling
 * - Centres on Bangalore if the user's location is unavailable
 *
 * Nothing is drawn from placeholder data: without coordinates the map just
 * shows the user's area.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type ViewStyle,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import * as Location from 'expo-location';

import { useApp } from '../context/AppContext';
import { MAPS_ENABLED } from '../config/maps';
import { Icon } from './Icon';
import { MapPlaceholder } from './MapPlaceholder';

/* ── Props ─────────────────────────────────────────────────────── */
interface LiveMapProps {
  showRoute?: boolean;
  showDriver?: boolean;
  style?: ViewStyle;
  /** Override the initial map region */
  initialRegion?: Region;
  /** Origin coordinate for the route line */
  origin?: { latitude: number; longitude: number };
  /** Destination coordinate for the route line */
  destination?: { latitude: number; longitude: number };
  /** Driver coordinate (only used when showDriver is true) */
  driverLocation?: { latitude: number; longitude: number };
}

/* ── Fallback camera centre (Bangalore) ─────────────────────────── */
const DEFAULT_REGION: Region = {
  latitude: 12.9352,
  longitude: 77.6245,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

/* ── Dark mode map style ─────────────────────────────────────────── */
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255d7c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
];

/* ── Component ───────────────────────────────────────────────────── */
export function LiveMap(props: LiveMapProps) {
  if (!MAPS_ENABLED) {
    return <MapPlaceholder style={[styles.container, props.style]} />;
  }
  return <GoogleLiveMap {...props} />;
}

function GoogleLiveMap({
  showRoute = false,
  showDriver = false,
  style,
  initialRegion,
  origin: originProp,
  destination: destinationProp,
  driverLocation: driverProp,
}: LiveMapProps) {
  const { isDarkMode, c } = useApp();
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const origin = originProp;
  const destination = destinationProp;
  const driverLocation = driverProp;
  const canShowRoute = showRoute && Boolean(origin && destination);
  const canShowDriver = showDriver && Boolean(driverLocation);

  /* ── Request location permission & get user position ──────────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
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

  /* ── Fit markers into view when route is visible ──────────────── */
  useEffect(() => {
    if (!canShowRoute || !mapRef.current || !origin || !destination) return;
    const coords = [origin, destination];
    if (canShowDriver && driverLocation) coords.push(driverLocation);

    // Small delay to let MapView fully mount
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [canShowRoute, canShowDriver, origin, destination, driverLocation]);

  /* ── Region to show ───────────────────────────────────────────── */
  const region: Region = initialRegion
    ?? (userLocation
      ? { ...userLocation, latitudeDelta: 0.06, longitudeDelta: 0.06 }
      : DEFAULT_REGION);

  return (
    <View testID="live-map" style={[styles.container, style]}>
      {loading ? (
        <View style={[styles.loader, { backgroundColor: isDarkMode ? '#1A1E2E' : '#EEF2F8' }]}>
          <ActivityIndicator testID="map-loader" size="large" color={c.primary} />
        </View>
      ) : (
        <MapView
          testID="live-map-view"
          // The native map reads the style once, so remount it on theme change
          key={isDarkMode ? 'dark' : 'light'}
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          customMapStyle={isDarkMode ? DARK_MAP_STYLE : undefined}
          mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          {/* ── Route polyline ────────────────────────────────── */}
          {canShowRoute && origin && destination && (
            <>
              {/* Straight dashed line: indicates direction, not the road route */}
              <Polyline
                coordinates={[origin, destination]}
                strokeColor={c.primary}
                strokeWidth={3}
                lineDashPattern={[8, 6]}
              />
              {/* Origin marker */}
              <Marker coordinate={origin} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.originMarkerOuter}>
                  <View style={styles.originMarkerInner} />
                </View>
              </Marker>
              {/* Destination marker */}
              <Marker coordinate={destination} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.destMarkerOuter}>
                  <View style={styles.destMarkerInner} />
                </View>
              </Marker>
            </>
          )}

          {/* ── Driver marker ─────────────────────────────────── */}
          {canShowDriver && driverLocation && (
            <Marker
              coordinate={driverLocation}
              anchor={{ x: 0.5, y: 0.5 }}
              title="Driver"
            >
              <View style={styles.driverMarkerOuter}>
                <View style={styles.driverMarkerInner}>
                  <Icon name="car" size={20} color="#FFFFFF" />
                </View>
              </View>
            </Marker>
          )}

          {/* ── User location blue dot (fallback if showsUserLocation fails) ── */}
          {userLocation && !canShowRoute && (
            <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.userDotOuter}>
                <View style={styles.userDotInner} />
              </View>
            </Marker>
          )}
        </MapView>
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

  // User dot — blue
  userDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(66,133,244,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    borderWidth: 2,
    borderColor: 'white',
  },
});
