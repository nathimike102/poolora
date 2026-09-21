/**
 * screens/rider/RiderHomeScreen.tsx
 *
 * Map-first home: the rider's area on top, and a sheet that scrolls up over it
 * with the destination search, recent and favourite places, the next booked
 * ride, and shortcuts to each kind of ride.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { LiveMap } from '../../components/LiveMap';
import { Icon, type IconName } from '../../components/Icon';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList, RiderTabParamList } from '../../navigation/types';
import { getSavedRoutes, deleteSavedRoute, type SavedRoute } from '../../services/savedRouteService';
import { getPlaceHistory, toggleFavouritePlace, type HistoryPlace } from '../../services/placeHistoryService';
import { rideService } from '../../services';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import { VEHICLE_CATEGORIES, type VehicleCategory } from '../../utils/vehicles';
import { logger } from '../../utils/logger';
import type { UpcomingBooking } from '../../types/api';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RiderTabParamList, 'RiderHome'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const MAX_PLACES = 4;

function formatDeparture(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

export function RiderHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mapHeight = Math.round(height * 0.36);
  const { place: here, status: hereStatus, refresh: refreshHere } = useCurrentPlace();

  const [places, setPlaces] = useState<HistoryPlace[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingBooking[] | null>(null);
  const [upcomingError, setUpcomingError] = useState(false);

  const loadUpcoming = useCallback(async () => {
    setUpcomingError(false);
    try {
      setUpcoming(await rideService.getUpcomingRides());
    } catch (error) {
      logger.error('Failed to fetch upcoming rides', { error });
      setUpcomingError(true);
      setUpcoming([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      getPlaceHistory().then(setPlaces).catch(() => {});
      getSavedRoutes().then(setSavedRoutes).catch(() => {});
      loadUpcoming();
    }, [loadUpcoming]),
  );

  const nextRide = upcoming?.[0];

  const pickupLabel =
    hereStatus === 'ready'
      ? here?.address ?? 'Current location'
      : hereStatus === 'loading'
        ? 'Finding your location…'
        : hereStatus === 'denied'
          ? 'Allow location to set your pickup'
          : "Couldn't find your location";

  const toggleFavourite = async (p: HistoryPlace) => {
    setPlaces(await toggleFavouritePlace(p));
  };

  const deleteRoute = (r: SavedRoute) => {
    Alert.alert('Remove saved route', `Remove "${r.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteSavedRoute(r.id);
          setSavedRoutes(prev => prev.filter(x => x.id !== r.id));
        },
      },
    ]);
  };

  const openCategory = (category: VehicleCategory) => navigation.navigate('Search', { category });

  return (
    <View style={[styles.root, { backgroundColor: c.surface }]}>
      {/* ── Map ──────────────────────────────────────────────── */}
      <View style={[styles.mapWrap, { height: mapHeight + 40 }]}>
        <LiveMap />
      </View>

      {/* ── Sheet (scrolls up over the map) ──────────────────── */}
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ paddingTop: mapHeight, paddingBottom: Spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          {/* Search */}
          <Pressable
            onPress={() => navigation.navigate('Search')}
            accessibilityRole="search"
            accessibilityLabel="Where are you going?"
            style={({ pressed }) => [
              styles.searchPill,
              { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
              Shadow.md,
            ]}
          >
            <Icon name="magnify" size={26} color={c.text} />
            <Text style={[styles.searchText, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Where are you going?
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Search', { schedule: true })}
              accessibilityRole="button"
              accessibilityLabel="Schedule a ride for later"
              hitSlop={8}
              style={[styles.laterChip, { backgroundColor: c.primaryLight }]}
            >
              <Icon name="calendar-clock" size={16} color={c.primary} />
              <Text style={[styles.laterText, { color: c.primary }]}>Later</Text>
            </Pressable>
          </Pressable>

          {/* Recent and favourite places */}
          {places.length > 0 ? (
            <View style={styles.placeList}>
              {places.slice(0, MAX_PLACES).map((p, i) => (
                <View
                  key={`${p.name}|${p.subtitle}`}
                  style={[
                    styles.placeRow,
                    i < Math.min(places.length, MAX_PLACES) - 1 && [styles.dashed, { borderColor: c.border }],
                  ]}
                >
                  <Pressable
                    onPress={() => navigation.navigate('Search', { drop: p })}
                    accessibilityRole="button"
                    accessibilityLabel={`Ride to ${p.name}`}
                    style={styles.placeMain}
                  >
                    <Icon name={p.favourite ? 'star-outline' : 'history'} size={22} color={c.textSec} />
                    <View style={styles.flex1}>
                      <Text style={[styles.placeName, { color: c.text }]} numberOfLines={1}>{p.name}</Text>
                      {p.subtitle ? (
                        <Text style={[styles.placeSub, { color: c.textSec }]} numberOfLines={1}>{p.subtitle}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleFavourite(p)}
                    accessibilityRole="button"
                    accessibilityLabel={p.favourite ? `Remove ${p.name} from favourites` : `Add ${p.name} to favourites`}
                    hitSlop={10}
                    style={styles.heartBtn}
                  >
                    <Icon name={p.favourite ? 'heart' : 'heart-outline'} size={24} color={p.favourite ? c.error : c.textSec} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.hint, { color: c.textSec }]}>
              Places you search for show up here. Tap the heart to keep one at the top.
            </Text>
          )}

          {/* Next ride */}
          {upcoming === null ? (
            <ActivityIndicator style={styles.loader} color={c.primary} accessibilityLabel="Loading your rides" />
          ) : upcomingError ? (
            <Pressable
              onPress={loadUpcoming}
              accessibilityRole="button"
              style={[styles.nextRide, { backgroundColor: c.errorLight, borderColor: c.errorLight }]}
            >
              <Icon name="alert-circle-outline" size={22} color={c.error} />
              <Text style={[styles.flex1, { color: c.text }]}>Your rides couldn't be loaded. Tap to retry.</Text>
            </Pressable>
          ) : nextRide ? (
            <Pressable
              onPress={() => navigation.navigate('ActiveRide', { rideId: nextRide.rideId, bookingId: nextRide.bookingId })}
              accessibilityRole="button"
              accessibilityLabel={`Your next ride to ${nextRide.to}, ${formatDeparture(nextRide.departureTime)}`}
              style={[styles.nextRide, { backgroundColor: c.primaryLight, borderColor: c.primaryLight }]}
            >
              <View style={[styles.nextIcon, { backgroundColor: c.surface }]}>
                <Icon name="car-clock" size={22} color={c.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.nextLabel, { color: c.primary }]}>
                  {nextRide.status === 'confirmed' ? 'Seat confirmed' : 'Waiting for the driver'}
                  {upcoming.length > 1 ? ` · ${upcoming.length - 1} more` : ''}
                </Text>
                <Text style={[styles.nextTitle, { color: c.text }]} numberOfLines={1}>To {nextRide.to}</Text>
                <Text style={[styles.placeSub, { color: c.textSec }]} numberOfLines={1}>
                  {formatDeparture(nextRide.departureTime)} with {nextRide.driverName}
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color={c.textSec} />
            </Pressable>
          ) : null}

          {/* Ride types */}
          <Text style={[styles.sectionTitle, { color: c.text }]}>Ride with Poolora</Text>
          <View style={styles.tileRow}>
            {(Object.keys(VEHICLE_CATEGORIES) as VehicleCategory[]).map(key => (
              <Tile
                key={key}
                icon={VEHICLE_CATEGORIES[key].icon}
                label={VEHICLE_CATEGORIES[key].label}
                onPress={() => openCategory(key)}
              />
            ))}
            <Tile icon="shield-check-outline" label="Safety" onPress={() => navigation.navigate('SOS')} />
          </View>

          {/* Saved routes */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline, { color: c.text }]}>Saved routes</Text>
            <Pressable
              onPress={() => navigation.navigate('AddSavedRoute')}
              accessibilityRole="button"
              accessibilityLabel="Add a saved route"
              hitSlop={8}
            >
              <Text style={[styles.link, { color: c.primary }]}>Add</Text>
            </Pressable>
          </View>
          {savedRoutes.length === 0 ? (
            <Text style={[styles.hint, styles.hintTight, { color: c.textSec }]}>
              Save a trip you make often, like home to work, and search it in one tap.
            </Text>
          ) : (
            savedRoutes.map(r => (
              <View key={r.id} style={[styles.routeRow, { borderColor: c.border }]}>
                <Pressable
                  onPress={() => navigation.navigate('Search', { from: r.from, to: r.to })}
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${r.name}: ${r.from} to ${r.to}`}
                  style={styles.placeMain}
                >
                  <View style={[styles.routeIcon, { backgroundColor: c.surfaceVariant }]}>
                    <Icon name={r.icon} size={20} color={c.primary} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={[styles.placeName, { color: c.text }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[styles.placeSub, { color: c.textSec }]} numberOfLines={1}>{r.from} → {r.to}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => deleteRoute(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove saved route ${r.name}`}
                  hitSlop={10}
                  style={styles.heartBtn}
                >
                  <Icon name="close" size={20} color={c.textSec} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Floating pickup pill and bell over the map ───────── */}
      <View style={[styles.topBar, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
        <Pressable
          onPress={() => (hereStatus === 'ready' ? navigation.navigate('Search') : refreshHere(true))}
          accessibilityRole="button"
          accessibilityLabel={`Pickup: ${pickupLabel}`}
          style={[styles.locationPill, { backgroundColor: c.surface }, Shadow.md]}
        >
          {hereStatus === 'loading' ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <View style={[styles.pickupDot, { borderColor: hereStatus === 'ready' ? c.success : c.warning }]} />
          )}
          <Text style={[styles.locationText, { color: c.text }]} numberOfLines={1}>{pickupLabel}</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={[styles.roundBtn, { backgroundColor: c.surface }, Shadow.md]}
        >
          <Icon name="bell-outline" size={22} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

function Tile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { c } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: c.surfaceVariant }]}>
        <Icon name={icon} size={30} color={c.primary} />
      </View>
      <Text style={[styles.tileLabel, { color: c.text }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  mapWrap: { position: 'absolute', top: 0, left: 0, right: 0 },

  topBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
  },
  pickupDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 4 },
  locationText: { flex: 1, fontSize: Typography.lg, fontWeight: Typography.medium },
  roundBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  sheet: {
    borderTopLeftRadius: Radius['4xl'],
    borderTopRightRadius: Radius['4xl'],
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    minHeight: 600,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: Spacing.lg },

  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  searchText: { flex: 1, fontSize: Typography['3xl'], fontWeight: Typography.bold },
  laterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  laterText: { fontSize: Typography.md, fontWeight: Typography.bold },

  placeList: { marginTop: Spacing.md },
  placeRow: { flexDirection: 'row', alignItems: 'center', minHeight: 68 },
  dashed: { borderBottomWidth: 1, borderStyle: 'dashed' },
  placeMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.md },
  placeName: { fontSize: Typography['2xl'], fontWeight: Typography.semibold },
  placeSub: { fontSize: Typography.md, marginTop: 2 },
  heartBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: Typography.md, lineHeight: 20, marginTop: Spacing.lg },
  hintTight: { marginTop: 0 },
  loader: { marginTop: Spacing.xl },

  nextRide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  nextIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  nextLabel: { fontSize: Typography.sm, fontWeight: Typography.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
  nextTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing['2xl'], marginBottom: Spacing.sm },
  sectionTitle: { fontSize: Typography['3xl'], fontWeight: Typography.bold, marginTop: Spacing['2xl'], marginBottom: Spacing.md },
  sectionTitleInline: { marginTop: 0, marginBottom: 0 },
  link: { fontSize: Typography.lg, fontWeight: Typography.bold },

  tileRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: { width: '23%', alignItems: 'center', gap: 6 },
  tileIcon: { width: '100%', aspectRatio: 1, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: Typography.base, fontWeight: Typography.semibold },

  routeRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  routeIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
