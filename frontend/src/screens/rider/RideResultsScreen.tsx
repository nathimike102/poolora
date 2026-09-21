/**
 * screens/rider/RideResultsScreen.tsx
 *
 * "Choose your ride": the searched route on a map, and below it every ride
 * going that way. Riders narrow by vehicle (bike, auto, cab), sort or filter
 * with chips, pick one row, set seats and book from the bar at the bottom.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { LiveMap } from '../../components/LiveMap';
import { Icon, type IconName } from '../../components/Icon';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import type { Ride as ApiRide, PaginatedResponse } from '../../types/api';
import { VEHICLE_CATEGORIES, vehicleCategory, type VehicleCategory } from '../../utils/vehicles';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'RideResults'>;
type ResultsRoute = RouteProp<RootStackParamList, 'RideResults'>;

type SortBy = 'best' | 'time' | 'price' | 'rating';

const SORTS: { key: SortBy; label: string }[] = [
  { key: 'time', label: 'Earliest' },
  { key: 'price', label: 'Cheapest' },
  { key: 'rating', label: 'Top rated' },
];

const MAX_SEATS_PER_BOOKING = 4;

interface ResultRide {
  id: string;
  category: VehicleCategory;
  driver: string;
  rating: number;
  ratingCount: number;
  vehicleName: string;
  departureAt: number;
  seatsLeft: number;
  price: number;
  matchScore: number;
  womenOnly: boolean;
  hasAC: boolean;
}

function toResult(r: ApiRide): ResultRide {
  const stats = r.driver?.stats;
  const v = r.vehicle;
  return {
    id: r._id,
    category: vehicleCategory(v?.vehicleType),
    driver: r.driver?.name || 'Driver',
    rating: stats?.avgRatingAsDriver ?? 0,
    ratingCount: stats?.totalRatingsAsDriver ?? 0,
    vehicleName: v ? [v.color, v.make, v.model].filter(Boolean).join(' ') : '',
    departureAt: r.scheduledDeparture ? new Date(r.scheduledDeparture).getTime() : 0,
    seatsLeft: r.availableSeats ?? 0,
    price: r.pricePerSeat ?? 0,
    matchScore: typeof r.matchScore === 'number' ? r.matchScore : 0,
    womenOnly: r.womenOnly ?? false,
    hasAC: r.hasAC ?? false,
  };
}

function formatLeaves(ms: number): string {
  if (!ms) return 'Time not set';
  const mins = Math.round((ms - Date.now()) / 60000);
  const clock = new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (mins <= 1) return `Leaving now · ${clock}`;
  if (mins < 60) return `Leaves in ${mins} min · ${clock}`;
  const d = new Date(ms);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === new Date().toDateString()) return `Leaves ${clock}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${clock}`;
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${clock}`;
}

export function RideResultsScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ResultsRoute>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const searched = route.params?.route;
  const incoming = route.params?.rides as PaginatedResponse<ApiRide> | ApiRide[] | undefined;

  const all = useMemo<ResultRide[]>(() => {
    const list = Array.isArray(incoming) ? incoming : incoming?.data?.items ?? [];
    return list.map(toResult);
  }, [incoming]);

  const counts = useMemo(() => {
    const n: Record<VehicleCategory, number> = { bike: 0, auto: 0, cab: 0 };
    all.forEach(r => { n[r.category] += 1; });
    return n;
  }, [all]);

  const [category, setCategory] = useState<VehicleCategory | 'all'>(route.params?.category ?? 'all');
  const [sortBy, setSortBy] = useState<SortBy>('best');
  const [womenOnly, setWomenOnly] = useState(false);
  const [acOnly, setAcOnly] = useState(false);
  const [seats, setSeats] = useState(searched?.seats ?? 1);

  const rides = useMemo(() => {
    const list = all.filter(r =>
      (category === 'all' || r.category === category) &&
      (!womenOnly || r.womenOnly) &&
      (!acOnly || r.hasAC),
    );
    // Leaving now, the best ride is the one leaving soonest; for a set time, the closest match
    const leavingNow = !searched?.when;
    const by: Record<SortBy, (a: ResultRide, b: ResultRide) => number> = {
      best: leavingNow
        ? (a, b) => a.departureAt - b.departureAt || b.matchScore - a.matchScore
        : (a, b) => b.matchScore - a.matchScore || a.departureAt - b.departureAt,
      time: (a, b) => a.departureAt - b.departureAt,
      price: (a, b) => a.price - b.price,
      rating: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount,
    };
    return [...list].sort(by[sortBy]);
  }, [all, category, womenOnly, acOnly, sortBy, searched?.when]);

  // Tag the single earliest and cheapest rides, as long as there's a choice
  const tags = useMemo(() => {
    const t: Record<string, string[]> = {};
    if (rides.length < 2) return t;
    const earliest = rides.reduce((a, b) => (b.departureAt < a.departureAt ? b : a));
    const cheapest = rides.reduce((a, b) => (b.price < a.price ? b : a));
    (t[earliest.id] ??= []).push('Earliest');
    (t[cheapest.id] ??= []).push('Cheapest');
    return t;
  }, [rides]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rides.find(r => r.id === selectedId) ?? rides.find(r => r.seatsLeft >= seats) ?? null;
  const maxSeats = Math.min(MAX_SEATS_PER_BOOKING, selected?.seatsLeft ?? MAX_SEATS_PER_BOOKING);
  const canBook = Boolean(selected && selected.seatsLeft >= seats);

  const changeSearch = (schedule = false) =>
    navigation.popTo('Search', schedule ? { schedule: true } : undefined, { merge: true });

  const mapHeight = Math.round(height * 0.32);
  // Stable references so the map only fits the route once
  const origin = useMemo(
    () => (searched?.pickup ? { latitude: searched.pickup.lat, longitude: searched.pickup.lng } : undefined),
    [searched?.pickup],
  );
  const destination = useMemo(
    () => (searched?.dropoff ? { latitude: searched.dropoff.lat, longitude: searched.dropoff.lng } : undefined),
    [searched?.dropoff],
  );
  const categories = (Object.keys(VEHICLE_CATEGORIES) as VehicleCategory[]).filter(k => counts[k] > 0);
  const filtersOn = womenOnly || acOnly || sortBy !== 'best';

  return (
    <View style={[styles.root, { backgroundColor: c.surface }]}>
      {/* ── Map with the searched route ──────────────────────── */}
      <View style={{ height: mapHeight + 24 }}>
        <LiveMap
          showRoute
          origin={origin}
          destination={destination}
        />
        <View style={[styles.mapTop, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.roundBtn, { backgroundColor: c.surface }, Shadow.md]}
          >
            <Icon name="arrow-left" size={24} color={c.text} />
          </Pressable>
          {searched && (
            <Pressable
              onPress={() => changeSearch()}
              accessibilityRole="button"
              accessibilityLabel={`From ${searched.from} to ${searched.to}. Edit`}
              style={[styles.routePill, { backgroundColor: c.surface }, Shadow.md]}
            >
              <View style={styles.flex1}>
                <View style={styles.routeLine}>
                  <View style={[styles.miniDot, { backgroundColor: c.success }]} />
                  <Text style={[styles.routeText, { color: c.text }]} numberOfLines={1}>{searched.from}</Text>
                </View>
                <View style={styles.routeLine}>
                  <View style={[styles.miniDot, { backgroundColor: c.error }]} />
                  <Text style={[styles.routeText, styles.routeTextStrong, { color: c.text }]} numberOfLines={1}>{searched.to}</Text>
                </View>
              </View>
              <Icon name="pencil-outline" size={20} color={c.textSec} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Sheet ─────────────────────────────────────────────── */}
      <View style={[styles.sheet, { backgroundColor: c.surface }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />

        {/* Vehicle tabs */}
        {categories.length > 1 && (
          <View style={[styles.tabs, { backgroundColor: c.surfaceVariant }]} accessibilityRole="tablist">
            {(['all', ...categories] as const).map(k => {
              const on = category === k;
              const label = k === 'all' ? `All ${all.length}` : `${VEHICLE_CATEGORIES[k].label} ${counts[k]}`;
              return (
                <Pressable
                  key={k}
                  onPress={() => setCategory(k)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.tab, on && [{ backgroundColor: c.surface }, Shadow.sm]]}
                >
                  {k !== 'all' && <Icon name={VEHICLE_CATEGORIES[k].icon} size={18} color={on ? c.primary : c.textSec} />}
                  <Text style={[styles.tabText, { color: on ? c.text : c.textSec }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Sort and filter chips */}
        {all.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
            {SORTS.map(s => (
              <Chip key={s.key} label={s.label} on={sortBy === s.key} onPress={() => setSortBy(sortBy === s.key ? 'best' : s.key)} />
            ))}
            <Chip label="Women only" icon="gender-female" on={womenOnly} onPress={() => setWomenOnly(v => !v)} />
            <Chip label="AC" icon="snowflake" on={acOnly} onPress={() => setAcOnly(v => !v)} />
          </ScrollView>
        )}

        {/* Rides */}
        <ScrollView style={styles.flex1} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {rides.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="car-clock" size={48} color={c.textSec} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                {all.length === 0 ? 'No rides going your way yet' : 'No rides match these filters'}
              </Text>
              <Text style={[styles.emptySub, { color: c.textSec }]}>
                {all.length === 0
                  ? 'Drivers post rides through the day. Try a different time, or a pickup nearer a main road.'
                  : 'Turn off a filter to see more rides.'}
              </Text>
              {all.length === 0 ? (
                <Pressable onPress={() => changeSearch(true)} accessibilityRole="button" style={[styles.emptyBtn, { borderColor: c.primary }]}>
                  <Text style={[styles.emptyBtnText, { color: c.primary }]}>Try another time</Text>
                </Pressable>
              ) : filtersOn || category !== 'all' ? (
                <Pressable
                  onPress={() => { setWomenOnly(false); setAcOnly(false); setSortBy('best'); setCategory('all'); }}
                  accessibilityRole="button"
                  style={[styles.emptyBtn, { borderColor: c.primary }]}
                >
                  <Text style={[styles.emptyBtnText, { color: c.primary }]}>Clear filters</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            rides.map(r => {
              const isSelected = selected?.id === r.id;
              const full = r.seatsLeft < seats;
              const cat = VEHICLE_CATEGORIES[r.category];
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedId(r.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: full }}
                  accessibilityLabel={`${cat.label} with ${r.driver}, ₹${r.price} per seat, ${formatLeaves(r.departureAt)}, ${r.seatsLeft} ${r.seatsLeft === 1 ? 'seat' : 'seats'} left`}
                  style={[
                    styles.ride,
                    { borderColor: isSelected ? c.primary : 'transparent', backgroundColor: c.surface },
                    full && styles.rideFull,
                  ]}
                >
                  <View style={[styles.vehicleIcon, { backgroundColor: c.surfaceVariant }]}>
                    <Icon name={cat.icon} size={30} color={c.primary} />
                  </View>
                  <View style={styles.flex1}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.rideTitle, { color: c.text }]}>{cat.label}</Text>
                      {tags[r.id]?.map(t => (
                        <View key={t} style={[styles.tag, { backgroundColor: c.successLight }]}>
                          <Text style={[styles.tagText, { color: c.successDark }]}>{t.toUpperCase()}</Text>
                        </View>
                      ))}
                      {r.womenOnly && (
                        <View style={[styles.tag, { backgroundColor: c.surfaceVariant }]}>
                          <Text style={[styles.tagText, { color: c.textSec }]}>WOMEN ONLY</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.rideMeta, { color: c.textSec }]} numberOfLines={1}>
                      {r.driver}
                      {r.ratingCount > 0 ? ` · ★ ${r.rating.toFixed(1)}` : ' · New driver'}
                      {r.vehicleName ? ` · ${r.vehicleName}` : ''}
                    </Text>
                    <Text style={[styles.rideMeta, { color: full ? c.error : c.textSec }]} numberOfLines={1}>
                      {formatLeaves(r.departureAt)} · {r.seatsLeft} {r.seatsLeft === 1 ? 'seat' : 'seats'} left
                    </Text>
                  </View>
                  <View style={styles.priceCol}>
                    <Text style={[styles.price, { color: c.text }]}>₹{r.price}</Text>
                    <Text style={[styles.perSeat, { color: c.textSec }]}>per seat</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* ── Book bar ─────────────────────────────────────────── */}
        {rides.length > 0 && (
          <View style={[styles.bookBar, { borderTopColor: c.border, paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.barRow}>
              <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={`${seats} ${seats === 1 ? 'seat' : 'seats'}`}>
                <Icon name="account-outline" size={20} color={c.text} />
                <Pressable
                  onPress={() => setSeats(s => Math.max(1, s - 1))}
                  disabled={seats <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Fewer seats"
                  hitSlop={6}
                  style={[styles.stepBtn, { borderColor: c.border, opacity: seats <= 1 ? 0.4 : 1 }]}
                >
                  <Icon name="minus" size={18} color={c.text} />
                </Pressable>
                <Text style={[styles.stepValue, { color: c.text }]}>{seats} {seats === 1 ? 'seat' : 'seats'}</Text>
                <Pressable
                  onPress={() => setSeats(s => Math.min(maxSeats, s + 1))}
                  disabled={seats >= maxSeats}
                  accessibilityRole="button"
                  accessibilityLabel="More seats"
                  hitSlop={6}
                  style={[styles.stepBtn, { borderColor: c.border, opacity: seats >= maxSeats ? 0.4 : 1 }]}
                >
                  <Icon name="plus" size={18} color={c.text} />
                </Pressable>
              </View>
              <View style={[styles.barDivider, { backgroundColor: c.border }]} />
              <Pressable
                onPress={() => selected && navigation.navigate('RideDetail', { rideId: selected.id })}
                disabled={!selected}
                accessibilityRole="button"
                accessibilityLabel="Ride details"
                style={styles.detailsBtn}
              >
                <Icon name="information-outline" size={20} color={c.text} />
                <Text style={[styles.detailsText, { color: c.text }]}>Details</Text>
                <Icon name="chevron-right" size={20} color={c.text} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => selected && navigation.navigate('Booking', { rideId: selected.id, seats })}
              disabled={!canBook}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canBook }}
              style={[styles.bookBtn, { backgroundColor: canBook ? c.primary : c.border }]}
            >
              <Text style={[styles.bookText, { color: canBook ? c.textOnPrimary : c.textSec }]}>
                {selected
                  ? canBook
                    ? `Book ${VEHICLE_CATEGORIES[selected.category].label} · ₹${(selected.price * seats).toLocaleString('en-IN')}`
                    : `Only ${selected.seatsLeft} ${selected.seatsLeft === 1 ? 'seat' : 'seats'} left`
                  : 'Choose a ride'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: IconName }) {
  const { c } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primaryLight : c.surface }]}
    >
      {icon && <Icon name={icon} size={16} color={on ? c.primary : c.textSec} />}
      <Text style={[styles.chipText, { color: on ? c.primary : c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  mapTop: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  roundBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  routePill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.xl },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 22 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  routeText: { flex: 1, fontSize: Typography.md },
  routeTextStrong: { fontWeight: Typography.bold },

  sheet: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: Radius['4xl'],
    borderTopRightRadius: Radius['4xl'],
    paddingTop: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: Spacing.md },

  tabs: { flexDirection: 'row', marginHorizontal: Spacing.lg, padding: 4, borderRadius: Radius.md, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, borderRadius: Radius.sm },
  tabText: { fontSize: Typography.md, fontWeight: Typography.bold },

  chipScroll: { flexGrow: 0 },
  chips: { gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1 },
  chipText: { fontSize: Typography.base, fontWeight: Typography.semibold },

  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, gap: 2 },
  ride: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
  },
  rideFull: { opacity: 0.55 },
  vehicleIcon: { width: 56, height: 56, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rideTitle: { fontSize: Typography['2xl'], fontWeight: Typography.bold },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: Typography.extrabold, letterSpacing: 0.4 },
  rideMeta: { fontSize: Typography.base, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: Typography['3xl'], fontWeight: Typography.extrabold },
  perSeat: { fontSize: Typography.xs },

  empty: { alignItems: 'center', paddingHorizontal: Spacing['2xl'], paddingTop: Spacing['2xl'], gap: Spacing.sm },
  emptyTitle: { fontSize: Typography['2xl'], fontWeight: Typography.bold, textAlign: 'center', marginTop: Spacing.sm },
  emptySub: { fontSize: Typography.md, lineHeight: 20, textAlign: 'center' },
  emptyBtn: { marginTop: Spacing.md, minHeight: 44, paddingHorizontal: Spacing.xl, borderRadius: Radius.full, borderWidth: 1.5, justifyContent: 'center' },
  emptyBtnText: { fontSize: Typography.lg, fontWeight: Typography.bold },

  bookBar: { borderTopWidth: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  stepper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: Typography.lg, fontWeight: Typography.bold, minWidth: 56, textAlign: 'center' },
  barDivider: { width: 1, height: 32, marginHorizontal: Spacing.md },
  detailsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  detailsText: { flex: 1, fontSize: Typography.lg, fontWeight: Typography.semibold },
  bookBtn: { minHeight: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  bookText: { fontSize: Typography.xl, fontWeight: Typography.bold },
});
