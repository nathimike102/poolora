/**
 * screens/rider/MapPickerScreen.tsx
 *
 * Lets the rider or driver move a real map under a fixed centre pin to choose
 * a place. The address shown is looked up for the pinned point, and the exact
 * point goes back with it, so the trip uses where the pin was, not wherever a
 * later lookup of the address lands.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import {
  Map as MapLibreMap,
  Camera,
  NativeUserLocation,
  type CameraRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { quickFix } from '../../utils/position';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { BackButton } from '../../components/BackButton';
import { resolveMapPick } from '../../utils/mapPick';
import { MapPlaceholder } from '../../components/MapPlaceholder';
import { MAPS_ENABLED, MAP_STYLE } from '../../config/maps';
import { reverseGeocodePlace } from '../../services/placesService';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';

import { tc, tk, useIsDark } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MapPicker'>;
type Route = RouteProp<RootStackParamList, 'MapPicker'>;

const LOOKUP_DEBOUNCE_MS = 500;
type Point = { latitude: number; longitude: number };

/** Camera starts over the market's centre (Harare) until the device location is known. */
const INITIAL_POINT: Point = REGION.center;
const PICKER_ZOOM = 15;

export function MapPickerScreen() {
  return MAPS_ENABLED ? <MapPickerView /> : <MapPickerUnavailable />;
}

/** Entry points hide "Select on map" when maps are off; this covers a stale deep link. */
function MapPickerUnavailable() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <MapPlaceholder caption={t('mapPicker.unavailable')} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton floating onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

function MapPickerView() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const route = useRoute<Route>();
  const isDarkMode = useIsDark();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupRequest = useRef(0);

  const isDestination = route.params.field === 'to';
  const [address, setAddress] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  // The pin lifts while the map moves and drops when it settles
  const [moving, setMoving] = useState(false);
  const picked = useRef<Point>(INITIAL_POINT);
  const here = useRef<Point | null>(null);

  const lookup = useCallback((region: Point) => {
    picked.current = region;
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
          lookup(INITIAL_POINT);
          return;
        }
        setLocationGranted(true);
        const fix = await quickFix();
        if (!fix) {
          lookup(INITIAL_POINT);
          return;
        }
        here.current = { latitude: fix.lat, longitude: fix.lng };
        cameraRef.current?.easeTo({ center: [here.current.longitude, here.current.latitude], zoom: PICKER_ZOOM, duration: 400 });
        lookup(here.current);
      } catch {
        lookup(INITIAL_POINT);
      }
    })();
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, [lookup]);

  const backToMe = () => {
    if (!here.current) return;
    cameraRef.current?.easeTo({ center: [here.current.longitude, here.current.latitude], zoom: PICKER_ZOOM, duration: 400 });
  };

  const confirm = () => {
    if (!address) return;
    const result = {
      pickedLocation: address,
      pickedField: route.params.field,
      pickedLat: picked.current.latitude,
      pickedLng: picked.current.longitude,
    };
    // A form waiting on pickOnMap gets the point and is shown again as it was
    if (route.params.requestId) {
      resolveMapPick(route.params.requestId, { address, lat: picked.current.latitude, lng: picked.current.longitude });
      navigation.goBack();
      return;
    }
    // Back to the screen underneath, keeping what was already entered there
    if (route.params.returnTo === 'CreateRide') {
      navigation.popTo('DriverTabs', { screen: 'CreateRide', params: result, merge: true });
    } else {
      navigation.popTo('Search', result, { merge: true });
    }
  };

  return (
    <View style={styles.root}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={isDarkMode ? MAP_STYLE.dark : MAP_STYLE.light}
        logo={false}
        compass={false}
        attributionPosition={{ top: insets.top + 80, right: 8 }}
        onRegionWillChange={() => setMoving(true)}
        onRegionDidChange={(event: { nativeEvent: ViewStateChangeEvent }) => {
          setMoving(false);
          const [longitude, latitude] = event.nativeEvent.center;
          lookup({ latitude, longitude });
        }}
        accessibilityLabel={t('mapPicker.mapMoveTheMapTo')}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [INITIAL_POINT.longitude, INITIAL_POINT.latitude], zoom: PICKER_ZOOM }}
        />
        {locationGranted && <NativeUserLocation />}
      </MapLibreMap>

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton floating onPress={() => navigation.goBack()} />
        <View style={[styles.headerCard, tc.backgroundColor_surface, Shadow.md]}>
          <Text style={[styles.headerTitle, tc.color_text]} accessibilityRole="header">
            {isDestination ? t('mapPicker.chooseDestination') : t('mapPicker.choosePickupPoint')}
          </Text>
          <Text style={[styles.headerSub, tc.color_textSec]}>{t('mapPicker.moveTheMapToPlace')}</Text>
        </View>
      </View>

      {/* Centre pin: the tip marks the map centre */}
      <View style={styles.pinWrap} pointerEvents="none">
        <View style={{ transform: [{ translateY: moving ? -10 : 0 }] }}>
          <Icon name="map-marker" size={48} color={tk.primary} />
        </View>
        {/* Marks the exact point under the pin's tip */}
        <View style={[styles.pinDot, { opacity: moving ? 0.5 : 1 }, tc.backgroundColor_primary]} />
      </View>

      {locationGranted && (
        <Pressable
          onPress={backToMe}
          accessibilityRole="button"
          accessibilityLabel={t('mapPicker.backToMyLocation')}
          style={[styles.locateBtn, Shadow.md, { bottom: insets.bottom + 170 }, tc.backgroundColor_surface]}
        >
          <Icon name="crosshairs-gps" size={22} color={tk.primary} />
        </Pressable>
      )}

      <View style={[styles.bottomSheet, Shadow.lg, { paddingBottom: insets.bottom + 16 }, tc.backgroundColor_surface]}>
        <View style={[styles.selectedRow, tc.backgroundColor_primaryLight]} accessibilityLiveRegion="polite">
          <Icon name="map-marker" size={18} color={tk.primary} />
          {looking ? (
            <ActivityIndicator size="small" color={tk.primary} />
          ) : (
            <Text style={[styles.selectedText, tc.color_text]} numberOfLines={2}>
              {address || (lookupFailed ? t('mapPicker.notFound') : t('mapPicker.finding'))}
            </Text>
          )}
        </View>

        <Pressable
          onPress={confirm}
          disabled={!address || looking}
          accessibilityRole="button"
          accessibilityState={{ disabled: !address || looking }}
          style={[styles.confirmBtn, address && !looking ? tc.backgroundColor_primary : tc.backgroundColor_border]}
        >
          <Text style={[styles.confirmText, address && !looking ? tc.color_textOnPrimary : tc.color_textSec]}>
            {t('mapPicker.useThisLocation')}
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
    // Pin (48) + dot (8, pulled up 4): this puts the dot's centre on the map's centre
    paddingBottom: 44,
  },
  pinDot: { width: 8, height: 8, borderRadius: 4, marginTop: -4 },
  locateBtn: {
    position: 'absolute',
    right: Spacing.xl,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
