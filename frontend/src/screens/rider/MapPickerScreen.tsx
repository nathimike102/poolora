/**
 * screens/rider/MapPickerScreen.tsx
 *
 * Lets the rider move a real map under a fixed centre pin to choose a pickup
 * or destination. The address shown is looked up for the pinned point.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { Icon } from '../../components/Icon';
import { BackButton } from '../../components/BackButton';
import { MapPlaceholder } from '../../components/MapPlaceholder';
import { MAPS_ENABLED } from '../../config/maps';
import { reverseGeocodePlace } from '../../services/placesService';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MapPicker'>;
type Route = RouteProp<RootStackParamList, 'MapPicker'>;

const LOOKUP_DEBOUNCE_MS = 500;
/** Camera starts over Bangalore until the device location is known. */
const INITIAL_REGION: Region = { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.04, longitudeDelta: 0.04 };

export function MapPickerScreen() {
  return MAPS_ENABLED ? <MapPickerView /> : <MapPickerUnavailable />;
}

/** Entry points hide "Select on map" without a Maps key; this covers a stale deep link. */
function MapPickerUnavailable() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <MapPlaceholder caption="The map isn't available right now. Go back and type the address instead." />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

function MapPickerView() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupRequest = useRef(0);

  const isDestination = route.params.field === 'to';
  const [address, setAddress] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);

  const lookup = useCallback((region: Region) => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(async () => {
      const requestId = ++lookupRequest.current;
      setLooking(true);
      setLookupFailed(false);
      try {
        const place = await reverseGeocodePlace(region.latitude, region.longitude);
        if (requestId === lookupRequest.current) setAddress(place.formattedAddress);
      } catch {
        if (requestId === lookupRequest.current) {
          setAddress('');
          setLookupFailed(true);
        }
      } finally {
        if (requestId === lookupRequest.current) setLooking(false);
      }
    }, LOOKUP_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          lookup(INITIAL_REGION);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const region = { ...INITIAL_REGION, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        mapRef.current?.animateToRegion(region, 400);
        lookup(region);
      } catch {
        lookup(INITIAL_REGION);
      }
    })();
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, [lookup]);

  const confirm = () => {
    if (!address) return;
    // Back to the search screen underneath, keeping what the rider already entered
    navigation.popTo('Search', { pickedLocation: address, pickedField: route.params.field }, { merge: true });
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={lookup}
        showsUserLocation
        accessibilityLabel="Map. Move the map to place the pin."
      />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={[styles.headerCard, { backgroundColor: c.surface }, Shadow.md]}>
          <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">
            {isDestination ? 'Choose destination' : 'Choose pickup point'}
          </Text>
          <Text style={[styles.headerSub, { color: c.textSec }]}>Move the map to place the pin</Text>
        </View>
      </View>

      {/* Centre pin: the tip marks the map centre */}
      <View style={styles.pinWrap} pointerEvents="none">
        <Icon name="map-marker" size={48} color={c.primary} />
      </View>

      <View style={[styles.bottomSheet, Shadow.lg, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.selectedRow, { backgroundColor: c.primaryLight }]} accessibilityLiveRegion="polite">
          <Icon name="map-marker" size={18} color={c.primary} />
          {looking ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Text style={[styles.selectedText, { color: c.text }]} numberOfLines={2}>
              {address || (lookupFailed ? "We couldn't find an address here. Move the pin slightly." : 'Finding address')}
            </Text>
          )}
        </View>

        <Pressable
          onPress={confirm}
          disabled={!address || looking}
          accessibilityRole="button"
          accessibilityState={{ disabled: !address || looking }}
          style={[styles.confirmBtn, { backgroundColor: address && !looking ? c.primary : c.border }]}
        >
          <Text style={[styles.confirmText, { color: address && !looking ? c.textOnPrimary : c.textSec }]}>
            Use this location
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  headerCard: { flex: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  headerTitle: { fontSize: 16, fontWeight: Typography.bold },
  headerSub: { fontSize: 12, marginTop: 2 },
  pinWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  selectedText: { flex: 1, fontSize: 14, fontWeight: Typography.semibold },
  confirmBtn: { minHeight: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: 16, fontWeight: Typography.bold },
});
