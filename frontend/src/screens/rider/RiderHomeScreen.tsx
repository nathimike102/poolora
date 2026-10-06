/**
 * screens/rider/RiderHomeScreen.tsx
 *
 * Map-first home: the rider's area on top, and a sheet that scrolls up over it
 * with the destination search, recent and favourite places, the next booked
 * ride, and shortcuts to each kind of ride.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Animated, View, Pressable, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { useNavigation, useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveMap } from '../../components/LiveMap';
import { Icon } from '../../components/Icon';
import { Icon3D, type Icon3DName } from '../../components/Icon3D';
import { ServiceTile, TileGrid } from '../../components/ServiceTile';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList, RiderTabParamList } from '../../navigation/types';
import { getSavedRoutes, deleteSavedRoute, type SavedRoute } from '../../services/savedRouteService';
import { getPlaceHistory, toggleFavouritePlace, type HistoryPlace } from '../../services/placeHistoryService';
import { rideService } from '../../services';
import { parcelService, type Parcel } from '../../services/parcelService';
import { tripService, type Trip } from '../../services/tripService';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import { VEHICLE_CATEGORIES, type VehicleCategory } from '../../utils/vehicles';
import { logger } from '../../utils/logger';
import type { UpcomingBooking } from '../../types/api';
import { REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

import { tc, tk } from '../../theme/themed';

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
  const time = d.toLocaleTimeString(REGION.dateLocale, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return i18n.t('home.today', { time });
  if (d.toDateString() === tomorrow.toDateString()) return i18n.t('home.tomorrow', { time });
  return `${d.toLocaleDateString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

type Segment = 'ride' | 'parcels' | 'trips';

/** Height of the pickup pill and the bell button */
const TOP_CONTROL = 48;

export function RiderHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mapHeight = Math.round(height * 0.36);
  const { place: here, status: hereStatus, refresh: refreshHere } = useCurrentPlace();
  // Once the sheet reaches the pickup pill and bell, they sit on a solid bar so
  // the tabs and places scroll under it rather than show through around them
  const scrollY = useRef(new Animated.Value(0)).current;
  const barHeight = insets.top + Spacing.sm + TOP_CONTROL + Spacing.sm;
  const barOpacity = scrollY.interpolate({
    inputRange: [mapHeight - barHeight - Spacing['2xl'], mapHeight - barHeight],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const [places, setPlaces] = useState<HistoryPlace[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingBooking[] | null>(null);
  const [upcomingError, setUpcomingError] = useState(false);
  // Ride, Parcels and Trips share the map and the "For you" tiles; the search
  // bar and the list under it change with the tab
  const [segment, setSegment] = useState<Segment>('ride');
  const [parcels, setParcels] = useState<Parcel[] | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);

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

  // Loaded when their tab is opened, and again each time the screen returns
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (segment === 'parcels') {
        parcelService.list('sender')
          .then(list => { if (active) setParcels(list.filter(p => p.status === 'pending' || p.status === 'confirmed')); })
          .catch(() => { if (active) setParcels([]); });
      }
      if (segment === 'trips') {
        tripService.mine()
          .then(list => { if (active) setTrips(list.filter(tr => tr.status === 'planning' || tr.status === 'ongoing')); })
          .catch(() => { if (active) setTrips([]); });
      }
      return () => { active = false; };
    }, [segment]),
  );

  const search = {
    ride: { label: t('home.whereTo'), go: () => navigation.navigate('Search') },
    parcels: { label: t('home.parcelWhere'), go: () => navigation.navigate('ShipParcel') },
    trips: { label: t('home.tripWhere'), go: () => navigation.navigate('PlanTrip') },
  }[segment];

  const nextRide = upcoming?.[0];

  const pickupLabel =
    hereStatus === 'ready'
      ? here?.address ?? t('home.currentLocation')
      : hereStatus === 'loading'
        ? t('home.findingLocation')
        : hereStatus === 'denied'
          ? t('home.allowLocation')
          : t('home.noLocation');

  const toggleFavourite = async (p: HistoryPlace) => {
    setPlaces(await toggleFavouritePlace(p));
  };

  const deleteRoute = (r: SavedRoute) => {
    Alert.alert(t('home.removeRouteTitle'), t('home.removeRouteBody', { name: r.name }), [
      { text: t('home.cancel'), style: 'cancel' },
      {
        text: t('home.remove'),
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
    <View style={[styles.root, tc.backgroundColor_surface]}>
      {/* ── Map ──────────────────────────────────────────────── */}
      <View style={[styles.mapWrap, { height: mapHeight + 40 }]}>
        <LiveMap />
      </View>

      {/* ── Sheet (scrolls up over the map) ──────────────────── */}
      <Animated.ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ paddingTop: mapHeight, paddingBottom: Spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <View style={[styles.sheet, tc.backgroundColor_surface]}>
          <View style={[styles.handle, tc.backgroundColor_border]} />

          {/* What to do: a ride, a parcel or a trip with others */}
          <View style={styles.segments}>
            {([
              ['ride', 'automobile'],
              ['parcels', 'package'],
              ['trips', 'handshake'],
            ] as [Segment, Icon3DName][]).map(([key, icon]) => {
              const on = segment === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSegment(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={styles.segment}
                >
                  <View style={styles.segmentRow}>
                    <Icon3D name={icon} size={28} />
                    <Text style={[styles.segmentText, { fontWeight: on ? '800' : '600' }, on ? tc.color_text : tc.color_textSec]}>{t(`home.segments.${key}`)}</Text>
                  </View>
                  <View style={[styles.segmentBar, on ? tc.backgroundColor_primary : {
                    backgroundColor: 'transparent'
                  }]} />
                </Pressable>
              );
            })}
          </View>

          {/* Search */}
          <Pressable
            onPress={search.go}
            accessibilityRole="search"
            accessibilityLabel={search.label}
            style={({ pressed }) => [
              styles.searchPill,
              { opacity: pressed ? 0.85 : 1 },
              tc.backgroundColor_surface,
              tc.borderColor_border,
              Shadow.md
            ]}
          >
            <Icon name="magnify" size={24} color={tk.text} />
            <Text style={[styles.searchText, tc.color_text]} numberOfLines={1}>
              {search.label}
            </Text>
            {segment === 'ride' ? (
            <Pressable
              onPress={() => navigation.navigate('Search', { schedule: true })}
              accessibilityRole="button"
              accessibilityLabel={t('home.scheduleLabel')}
              hitSlop={8}
              style={[styles.laterChip, tc.backgroundColor_primaryLight]}
            >
              <Icon name="calendar-clock" size={16} color={tk.primary} />
              <Text style={[styles.laterText, tc.color_primary]}>{t('home.later')}</Text>
            </Pressable>
            ) : null}
          </Pressable>

          {segment === 'parcels' ? (
            <ItemList
              items={parcels}
              empty={t('home.parcelsHint')}
              render={p => {
                const place = p.deliveryLocation.address.split(',')[0];
                const status = t(`home.parcelStatus.${p.status === 'confirmed' ? 'confirmed' : 'pending'}`);
                return {
                  key: p._id,
                  icon: 'package',
                  title: t('home.parcelTo', { place }),
                  sub: status,
                  label: t('home.parcelLabel', { place, status }),
                  onPress: () => navigation.navigate('ParcelTracking', { trackingNumber: p.trackingNumber }),
                };
              }}
            />
          ) : segment === 'trips' ? (
            <>
              <ItemList
                items={trips}
                empty={t('home.tripsHint')}
                render={tr => {
                  const dates = `${new Date(tr.startDate).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short' })} – ${new Date(tr.endDate).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short' })}`;
                  return {
                    key: tr._id,
                    icon: 'handshake',
                    title: tr.title,
                    sub: dates,
                    label: t('home.tripLabel', { title: tr.title, dates }),
                    onPress: () => navigation.navigate('TripDetail', { tripId: tr._id }),
                  };
                }}
              />
              <Pressable onPress={() => navigation.navigate('TripPartners')} accessibilityRole="button" style={styles.partnersLink}>
                <Icon name="account-search-outline" size={22} color={tk.primary} />
                <Text style={[styles.link, tc.color_primary]}>{t('home.findPartners')}</Text>
              </Pressable>
            </>
          ) : null}

          {/* Recent and favourite places */}
          {segment !== 'ride' ? null : places.length > 0 ? (
            <View style={styles.placeList}>
              {places.slice(0, MAX_PLACES).map((p, i) => (
                <View
                  key={`${p.name}|${p.subtitle}`}
                  style={[
                    styles.placeRow,
                    i < Math.min(places.length, MAX_PLACES) - 1 && [styles.dashed, tc.borderColor_border],
                  ]}
                >
                  <Pressable
                    onPress={() => navigation.navigate('Search', { drop: p })}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.rideTo', { name: p.name })}
                    style={styles.placeMain}
                  >
                    <Icon name={p.favourite ? 'star-outline' : 'history'} size={22} color={tk.textSec} />
                    <View style={styles.flex1}>
                      <Text style={[styles.placeName, tc.color_text]} numberOfLines={1}>{p.name}</Text>
                      {p.subtitle ? (
                        <Text style={[styles.placeSub, tc.color_textSec]} numberOfLines={1}>{p.subtitle}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleFavourite(p)}
                    accessibilityRole="button"
                    accessibilityLabel={p.favourite ? t('home.unfavourite', { name: p.name }) : t('home.favourite', { name: p.name })}
                    hitSlop={10}
                    style={styles.heartBtn}
                  >
                    <Icon name={p.favourite ? 'heart' : 'heart-outline'} size={24} color={p.favourite ? tk.heart : tk.textSec} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.hint, tc.color_textSec]}>
              {t('home.placesHint')}
            </Text>
          )}

          {/* Next ride */}
          {segment !== 'ride' ? null : upcoming === null ? (
            <ActivityIndicator style={styles.loader} color={tk.primary} accessibilityLabel={t('home.loadingRides')} />
          ) : upcomingError ? (
            <Pressable
              onPress={loadUpcoming}
              accessibilityRole="button"
              style={[styles.nextRide, tc.backgroundColor_errorLight, tc.borderColor_errorLight]}
            >
              <Icon name="alert-circle-outline" size={22} color={tk.error} />
              <Text style={[styles.flex1, tc.color_text]}>{t('home.ridesFailed')}</Text>
            </Pressable>
          ) : nextRide ? (
            <Pressable
              onPress={() => navigation.navigate('ActiveRide', { rideId: nextRide.rideId, bookingId: nextRide.bookingId })}
              accessibilityRole="button"
              accessibilityLabel={t('home.nextRideLabel', { to: nextRide.to, when: formatDeparture(nextRide.departureTime) })}
              style={[
                styles.nextRide,
                tc.backgroundColor_primaryLight,
                tc.borderColor_primaryLight
              ]}
            >
              <Icon3D name="automobile" size={44} />
              <View style={styles.flex1}>
                <Text style={[styles.nextLabel, tc.color_primary]}>
                  {nextRide.status === 'confirmed' ? t('home.seatConfirmed') : t('home.waitingDriver')}
                  {upcoming.length > 1 ? t('home.more', { count: upcoming.length - 1 }) : ''}
                </Text>
                <Text style={[styles.nextTitle, tc.color_text]} numberOfLines={1}>{t('home.to', { place: nextRide.to })}</Text>
                <Text style={[styles.placeSub, tc.color_textSec]} numberOfLines={1}>
                  {t('home.withDriver', { when: formatDeparture(nextRide.departureTime), driver: nextRide.driverName })}
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color={tk.textSec} />
            </Pressable>
          ) : null}

          {/* Ride types and the things people use most */}
          <Text style={[styles.sectionTitle, tc.color_text]}>{t('home.forYou')}</Text>
          <TileGrid>
            {(Object.keys(VEHICLE_CATEGORIES) as VehicleCategory[]).map(key => (
              <ServiceTile
                key={key}
                icon={VEHICLE_CATEGORIES[key].icon3d}
                label={VEHICLE_CATEGORIES[key].label}
                onPress={() => openCategory(key)}
              />
            ))}
            <ServiceTile icon="package" label={t('home.segments.parcels')} onPress={() => navigation.navigate('ShipParcel')} />
            <ServiceTile icon="briefcase" label={t('home.work')} onPress={() => navigation.navigate('Work')} />
            <ServiceTile icon="shield" label={t('home.safety')} onPress={() => navigation.navigate('SOS')} />
          </TileGrid>

          {/* Saved routes */}
          {segment === 'ride' ? (
          <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline, tc.color_text]}>{t('home.savedRoutes')}</Text>
            <Pressable
              onPress={() => navigation.navigate('AddSavedRoute')}
              accessibilityRole="button"
              accessibilityLabel={t('home.addRouteLabel')}
              hitSlop={8}
            >
              <Text style={[styles.link, tc.color_primary]}>{t('home.add')}</Text>
            </Pressable>
          </View>
          {savedRoutes.length === 0 ? (
            <Text style={[styles.hint, styles.hintTight, tc.color_textSec]}>
              {t('home.routesHint')}
            </Text>
          ) : (
            savedRoutes.map(r => (
              <View key={r.id} style={[styles.routeRow, tc.borderColor_border]}>
                <Pressable
                  onPress={() => navigation.navigate('Search', { from: r.from, to: r.to })}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.searchRoute', { name: r.name, from: r.from, to: r.to })}
                  style={styles.placeMain}
                >
                  <View style={[styles.routeIcon, tc.backgroundColor_surfaceVariant]}>
                    <Icon name={r.icon} size={20} color={tk.primary} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={[styles.placeName, tc.color_text]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[styles.placeSub, tc.color_textSec]} numberOfLines={1}>{r.from} → {r.to}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => deleteRoute(r)}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.removeRoute', { name: r.name })}
                  hitSlop={10}
                  style={styles.heartBtn}
                >
                  <Icon name="close" size={20} color={tk.textSec} />
                </Pressable>
              </View>
            ))
          )}
          </>
          ) : null}
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[styles.barBackdrop, { height: barHeight, opacity: barOpacity }, tc.backgroundColor_surface]}
      />

      {/* ── Floating pickup pill and bell over the map ───────── */}
      <View style={[styles.topBar, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
        <Pressable
          onPress={() => (hereStatus === 'ready' ? navigation.navigate('Search') : refreshHere(true))}
          accessibilityRole="button"
          accessibilityLabel={t('home.pickupLabel', { place: pickupLabel })}
          style={[styles.locationPill, tc.backgroundColor_surface, Shadow.md]}
        >
          {hereStatus === 'loading' ? (
            <ActivityIndicator size="small" color={tk.primary} />
          ) : (
            <View style={[styles.pickupDot, hereStatus === 'ready' ? tc.borderColor_success : tc.borderColor_warning]} />
          )}
          <Text style={[styles.locationText, tc.color_text]} numberOfLines={1}>{pickupLabel}</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Notifications')}
          accessibilityRole="button"
          accessibilityLabel={t('home.notifications')}
          style={[styles.roundBtn, tc.backgroundColor_surface, Shadow.md]}
        >
          <Icon name="bell-outline" size={22} color={tk.text} />
        </Pressable>
      </View>
    </View>
  );
}

interface ListItem {
  key: string;
  icon: Icon3DName;
  title: string;
  sub: string;
  label: string;
  onPress: () => void;
}

/** The parcel or trip list under the search bar: a few rows, or a hint */
function ItemList<T>({ items, empty, render }: { items: T[] | null; empty: string; render: (item: T) => ListItem }) {
  if (items === null) return <ActivityIndicator style={styles.loader} color={tk.primary} />;
  if (items.length === 0) return <Text style={[styles.hint, tc.color_textSec]}>{empty}</Text>;
  return (
    <View style={styles.placeList}>
      {items.slice(0, MAX_PLACES).map(render).map((it, i, all) => (
        <Pressable
          key={it.key}
          onPress={it.onPress}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          style={[styles.placeRow, styles.placeMain, i < all.length - 1 && [styles.dashed, tc.borderColor_border]]}
        >
          <Icon3D name={it.icon} size={36} />
          <View style={styles.flex1}>
            <Text style={[styles.placeName, tc.color_text]} numberOfLines={1}>{it.title}</Text>
            <Text style={[styles.placeSub, tc.color_textSec]} numberOfLines={1}>{it.sub}</Text>
          </View>
          <Icon name="chevron-right" size={22} color={tk.textSec} />
        </Pressable>
      ))}
    </View>
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
    minHeight: TOP_CONTROL,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
  },
  pickupDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 4 },
  locationText: { flex: 1, fontSize: Typography.lg, fontWeight: Typography.medium },
  roundBtn: { width: TOP_CONTROL, height: TOP_CONTROL, borderRadius: TOP_CONTROL / 2, alignItems: 'center', justifyContent: 'center' },
  barBackdrop: { position: 'absolute', top: 0, left: 0, right: 0 },

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
    gap: Spacing.sm,
    minHeight: 64,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  // One size on every tab, small enough that the longest label fits beside "Later"
  searchText: { flex: 1, fontSize: 18, fontWeight: Typography.bold },
  laterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: Spacing.sm + 2,
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
  nextLabel: { fontSize: Typography.sm, fontWeight: Typography.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
  nextTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing['2xl'], marginBottom: Spacing.sm },
  sectionTitle: { fontSize: Typography['3xl'], fontWeight: Typography.bold, marginTop: Spacing['2xl'], marginBottom: Spacing.md },
  sectionTitleInline: { marginTop: 0, marginBottom: 0 },
  link: { fontSize: Typography.lg, fontWeight: Typography.bold },
  partnersLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 48, marginTop: Spacing.sm },

  segments: { flexDirection: 'row', gap: Spacing.xl, marginBottom: Spacing.lg },
  segment: { gap: 8 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentText: { fontSize: Typography['2xl'] },
  segmentBar: { height: 3, borderRadius: 2 },

  routeRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  routeIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
