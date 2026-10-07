/**
 * screens/rider/RideResultsScreen.tsx
 *
 * "Choose your ride": the searched route on a map, and below it every ride
 * going that way. Riders narrow by vehicle (bike, auto, cab), sort or filter
 * with chips, pick one row, set seats and book from the bar at the bottom.
 */

import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { Text } from '../../components/Text';
import { EmptyArt } from '../../components/EmptyState';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveMap } from '../../components/LiveMap';
import { Icon3D } from '../../components/Icon3D';
import { Icon, type IconName } from '../../components/Icon';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import type { Ride as ApiRide, PaginatedResponse } from '../../types/api';
import { rideAlertService } from '../../services/rideAlertService';
import { errorHandler } from '../../utils/errorHandler';
import { VEHICLE_CATEGORIES, vehicleCategory, type VehicleCategory } from '../../utils/vehicles';
import { REGION, money } from '../../utils/region';
import { identityService } from '../../services/identityService';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

import { tc, tk } from '../../theme/themed';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'RideResults'>;
type ResultsRoute = RouteProp<RootStackParamList, 'RideResults'>;

type SortBy = 'best' | 'time' | 'price' | 'rating';

/** Labels are in the catalogue under results.sort */
const SORTS: SortBy[] = ['time', 'price', 'rating'];

const MAX_SEATS_PER_BOOKING = 4;

interface ResultRide {
  id: string;
  category: VehicleCategory;
  driver: string;
  driverVerified: boolean;
  /** A GPS tracker in the car: it can be followed even with every phone off */
  trackedCar: boolean;
  rating: number;
  ratingCount: number;
  vehicleName: string;
  departureAt: number;
  seatsLeft: number;
  price: number;
  matchScore: number;
  womenOnly: boolean;
  /** Only the driver's colleagues see it (UC-C02) */
  colleaguesOnly: boolean;
  /** The driver's company, when the rider works there too */
  colleagueAt?: string;
  hasAC: boolean;
}

function toResult(r: ApiRide): ResultRide {
  const stats = r.driver?.stats;
  const v = r.vehicle;
  return {
    id: r._id,
    category: vehicleCategory(v?.vehicleType),
    driver: r.driver?.name || i18n.t('results.driver'),
    driverVerified: Boolean(r.driver?.verified),
    trackedCar: Boolean(r.driver?.trackedCar),
    // Everyone starts at 5 stars until rated
    rating: stats?.totalRatingsAsDriver ? stats.avgRatingAsDriver ?? 5 : 5,
    ratingCount: stats?.totalRatingsAsDriver ?? 0,
    vehicleName: v ? [v.color, v.make, v.model].filter(Boolean).join(' ') : '',
    departureAt: r.scheduledDeparture ? new Date(r.scheduledDeparture).getTime() : 0,
    seatsLeft: r.availableSeats ?? 0,
    price: r.pricePerSeat ?? 0,
    matchScore: typeof r.matchScore === 'number' ? r.matchScore : 0,
    womenOnly: r.womenOnly ?? false,
    colleaguesOnly: Boolean(r.colleaguesOnly),
    colleagueAt: r.driver?.colleagueAt,
    hasAC: r.hasAC ?? false,
  };
}

function formatLeaves(ms: number): string {
  if (!ms) return i18n.t('results.timeNotSet');
  const mins = Math.round((ms - Date.now()) / 60000);
  const clock = new Date(ms).toLocaleTimeString(REGION.dateLocale, { hour: 'numeric', minute: '2-digit' });
  if (mins <= 1) return i18n.t('results.leavingNow', { clock });
  if (mins < 60) return i18n.t('results.leavesIn', { mins, clock });
  const d = new Date(ms);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === new Date().toDateString()) return i18n.t('results.leaves', { clock });
  if (d.toDateString() === tomorrow.toDateString()) return i18n.t('results.tomorrow', { clock });
  return `${d.toLocaleDateString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })}, ${clock}`;
}

export function RideResultsScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ResultsRoute>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const searched = route.params?.route;
  // The rider boards where they searched from, which may be part-way along the route
  const riderStops = {
    pickup: searched?.pickup ? { ...searched.pickup, address: searched.from } : undefined,
    dropoff: searched?.dropoff ? { ...searched.dropoff, address: searched.to } : undefined,
  };
  const incoming = route.params?.rides as PaginatedResponse<ApiRide> | ApiRide[] | undefined;

  // Nothing matched exactly: the server looked again with a wider window and radius
  const widened = Array.isArray(incoming) ? undefined : incoming?.data?.alternatives;
  const exact = useMemo(() => (Array.isArray(incoming) ? incoming : incoming?.data?.items ?? []), [incoming]);
  const showingAlternatives = exact.length === 0 && Boolean(widened?.items.length);
  const all = useMemo<ResultRide[]>(
    () => (showingAlternatives ? widened!.items : exact).map(toResult),
    [exact, widened, showingAlternatives],
  );

  // "Tell me when a ride appears on this route" (UC-R02 6a)
  const [alertState, setAlertState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const canAlert = Boolean(searched?.pickup && searched?.dropoff);
  const saveAlert = async () => {
    if (!searched?.pickup || !searched?.dropoff) return;
    setAlertState('saving');
    try {
      await rideAlertService.create(
        { ...searched.pickup, address: searched.from },
        { ...searched.dropoff, address: searched.to },
        searched.when,
      );
      setAlertState('saved');
    } catch (error) {
      setAlertState('idle');
      Alert.alert(t('results.alertFailed'), errorHandler.process(error).message);
    }
  };
  const alertButton = canAlert ? (
    <Pressable
      onPress={saveAlert}
      disabled={alertState !== 'idle'}
      accessibilityRole="button"
      style={[styles.emptyBtn, { opacity: alertState === 'saving' ? 0.6 : 1 }, tc.borderColor_primary]}
    >
      <Text style={[styles.emptyBtnText, tc.color_primary]}>
        {alertState === 'saved' ? t('results.alertSaved') : t('results.alertAsk')}
      </Text>
    </Pressable>
  ) : null;

  const counts = useMemo(() => {
    const n: Record<VehicleCategory, number> = { car: 0, suv: 0, minivan: 0, auto: 0, bike: 0 };
    all.forEach(r => { n[r.category] += 1; });
    return n;
  }, [all]);

  const [category, setCategory] = useState<VehicleCategory | 'all'>(route.params?.category ?? 'all');
  const [sortBy, setSortBy] = useState<SortBy>('best');
  const [womenOnly, setWomenOnly] = useState(false);

  // Women-only rides reach only women whose identity check passed; explain rather than show an empty list
  const toggleWomenOnly = async () => {
    if (womenOnly) {
      setWomenOnly(false);
      return;
    }
    const identity = await identityService.status().catch(() => null);
    if (identity?.status === 'verified' && identity.gender === 'female') {
      setWomenOnly(true);
      return;
    }
    Alert.alert(
      t('results.womenTitle'),
      identity?.status === 'pending'
        ? t('results.womenPending')
        : t('results.womenExplain'),
      identity?.status === 'pending'
        ? [{ text: t('results.ok') }]
        : [{ text: t('results.notNow'), style: 'cancel' }, { text: t('results.verify'), onPress: () => navigation.navigate('IdentityCheck') }],
    );
  };
  const [acOnly, setAcOnly] = useState(false);
  const [colleaguesOnly, setColleaguesOnly] = useState(false);
  const hasColleagues = all.some(r => r.colleagueAt);
  const [seats, setSeats] = useState(searched?.seats ?? 1);

  const rides = useMemo(() => {
    const list = all.filter(r =>
      (category === 'all' || r.category === category) &&
      (!womenOnly || r.womenOnly) &&
      (!acOnly || r.hasAC) &&
      (!colleaguesOnly || Boolean(r.colleagueAt)),
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
  }, [all, category, womenOnly, acOnly, colleaguesOnly, sortBy, searched?.when]);

  // Tag the single earliest and cheapest rides, as long as there's a choice
  const tags = useMemo(() => {
    const byRide: Record<string, SortBy[]> = {};
    if (rides.length < 2) return byRide;
    const earliest = rides.reduce((a, b) => (b.departureAt < a.departureAt ? b : a));
    const cheapest = rides.reduce((a, b) => (b.price < a.price ? b : a));
    (byRide[earliest.id] ??= []).push('time');
    (byRide[cheapest.id] ??= []).push('price');
    return byRide;
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
  const filtersOn = womenOnly || acOnly || colleaguesOnly || sortBy !== 'best';

  return (
    <View style={[styles.root, tc.backgroundColor_surface]}>
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
            accessibilityLabel={t('results.goBack')}
            style={[styles.roundBtn, tc.backgroundColor_surface, Shadow.md]}
          >
            <Icon name="arrow-left" size={24} color={tk.text} />
          </Pressable>
          {searched && (
            <Pressable
              onPress={() => changeSearch()}
              accessibilityRole="button"
              accessibilityLabel={t('results.routeLabel', { from: searched.from, to: searched.to })}
              style={[styles.routePill, tc.backgroundColor_surface, Shadow.md]}
            >
              <View style={styles.flex1}>
                <View style={styles.routeLine}>
                  <View style={[styles.miniDot, tc.backgroundColor_success]} />
                  <Text style={[styles.routeText, tc.color_text]} numberOfLines={1}>{searched.from}</Text>
                </View>
                <View style={styles.routeLine}>
                  <View style={[styles.miniDot, tc.backgroundColor_error]} />
                  <Text style={[styles.routeText, styles.routeTextStrong, tc.color_text]} numberOfLines={1}>{searched.to}</Text>
                </View>
              </View>
              <Icon name="pencil-outline" size={20} color={tk.textSec} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Sheet ─────────────────────────────────────────────── */}
      <View style={[styles.sheet, tc.backgroundColor_surface]}>
        <View style={[styles.handle, tc.backgroundColor_border]} />

        {/* Vehicle tabs */}
        {categories.length > 1 && (
          <View style={[styles.tabs, tc.backgroundColor_surfaceVariant]} accessibilityRole="tablist">
            {(['all', ...categories] as const).map(k => {
              const on = category === k;
              const label = k === 'all' ? t('results.all', { count: all.length }) : `${VEHICLE_CATEGORIES[k].label} ${counts[k]}`;
              return (
                <Pressable
                  key={k}
                  onPress={() => setCategory(k)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.tab, on && [tc.backgroundColor_surface, Shadow.sm]]}
                >
                  {k !== 'all' && <Icon name={VEHICLE_CATEGORIES[k].icon} size={18} color={on ? tk.primary : tk.textSec} />}
                  <Text style={[styles.tabText, on ? tc.color_text : tc.color_textSec]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Sort and filter chips */}
        {all.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
            {SORTS.map(key => (
              <Chip key={key} label={t(`results.sort.${key}`)} on={sortBy === key} onPress={() => setSortBy(sortBy === key ? 'best' : key)} />
            ))}
            <Chip label={t('results.womenOnly')} icon="gender-female" on={womenOnly} onPress={toggleWomenOnly} />
            <Chip label={t('results.ac')} icon="snowflake" on={acOnly} onPress={() => setAcOnly(v => !v)} />
            {hasColleagues ? <Chip label={t('results.colleagues')} icon="briefcase-outline" on={colleaguesOnly} onPress={() => setColleaguesOnly(v => !v)} /> : null}
          </ScrollView>
        )}

        {/* Rides */}
        <ScrollView style={styles.flex1} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {showingAlternatives && rides.length > 0 ? (
            <View style={[styles.altBanner, tc.backgroundColor_surfaceVariant]}>
              <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>{t('results.noExact')}</Text>
              <Text style={[{ fontSize: 13 }, tc.color_textSec]}>
                {t('results.widened', { hours: Math.round((widened?.timeDeviationMins ?? 180) / 60), km: widened?.radiusKm })}
              </Text>
              {alertButton}
            </View>
          ) : null}
          {rides.length === 0 ? (
            <View style={styles.empty}>
              <EmptyArt icon="oncomingAutomobile" />
              <Text style={[styles.emptyTitle, tc.color_text]}>
                {all.length === 0 ? t('results.noneYet') : t('results.noneFiltered')}
              </Text>
              <Text style={[styles.emptySub, tc.color_textSec]}>
                {all.length === 0
                  ? t('results.noneYetHelp')
                  : t('results.noneFilteredHelp')}
              </Text>
              {all.length === 0 ? (
                <>
                  <Pressable onPress={() => changeSearch(true)} accessibilityRole="button" style={[styles.emptyBtn, tc.borderColor_primary]}>
                    <Text style={[styles.emptyBtnText, tc.color_primary]}>{t('results.anotherTime')}</Text>
                  </Pressable>
                  {alertButton}
                </>
              ) : filtersOn || category !== 'all' ? (
                <Pressable
                  onPress={() => { setWomenOnly(false); setAcOnly(false); setColleaguesOnly(false); setSortBy('best'); setCategory('all'); }}
                  accessibilityRole="button"
                  style={[styles.emptyBtn, tc.borderColor_primary]}
                >
                  <Text style={[styles.emptyBtnText, tc.color_primary]}>{t('results.clearFilters')}</Text>
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
                  accessibilityLabel={t('results.rideLabel', { vehicle: cat.label, verified: r.driverVerified ? t('results.verifiedDriver') : '', driver: r.driver, price: money(r.price), when: formatLeaves(r.departureAt), left: r.seatsLeft === 1 ? t('results.seatsLeftOne') : t('results.seatsLeftMany', { count: r.seatsLeft }) })}
                  style={[
                    styles.ride,
                    tc.backgroundColor_surface, tc.cardOutline, isSelected && [{ borderWidth: 1.5 }, tc.borderColor_primary],
                    full && styles.rideFull,
                  ]}
                >
                  <View style={[styles.vehicleIcon, tc.backgroundColor_surfaceVariant]}>
                    <Icon3D name={cat.icon3d} size={46} />
                  </View>
                  <View style={styles.flex1}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.rideTitle, tc.color_text]}>{cat.label}</Text>
                      {tags[r.id]?.map(tag => (
                        <View key={tag} style={[styles.tag, tc.backgroundColor_successLight]}>
                          <Text style={[styles.tagText, tc.color_successDark]}>{t(`results.sort.${tag}`).toUpperCase()}</Text>
                        </View>
                      ))}
                      {r.womenOnly && (
                        <View style={[styles.tag, tc.backgroundColor_surfaceVariant]}>
                          <Text style={[styles.tagText, tc.color_textSec]}>{t('results.womenOnlyTag')}</Text>
                        </View>
                      )}
                      {r.colleaguesOnly && (
                        <View style={[styles.tag, tc.backgroundColor_surfaceVariant]}>
                          <Text style={[styles.tagText, tc.color_textSec]}>{t('results.colleaguesOnlyTag')}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.driverLine}>
                      {r.driverVerified ? <VerifiedBadge compact /> : null}
                      <Text style={[styles.rideMeta, { flexShrink: 1 }, tc.color_textSec]} numberOfLines={1}>
                        {r.driver}
                        {r.ratingCount > 0 ? ` · ★ ${r.rating.toFixed(1)}` : t('results.newDriver')}
                        {r.vehicleName ? ` · ${r.vehicleName}` : ''}
                      </Text>
                    </View>
                    {r.colleagueAt ? (
                      <View style={styles.trackedLine}>
                        <Icon name="briefcase-outline" size={13} color={tk.primary} />
                        <Text style={[styles.rideMeta, tc.color_primary]}>{t('results.worksAt', { company: r.colleagueAt })}</Text>
                      </View>
                    ) : null}
                    {r.trackedCar ? (
                      <View style={styles.trackedLine} accessibilityLabel={t('results.trackedLabel')}>
                        <Icon name="crosshairs-gps" size={13} color={tk.success} />
                        <Text style={[styles.rideMeta, tc.color_success]}>{t('results.tracked')}</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.rideMeta, full ? tc.color_error : tc.color_textSec]} numberOfLines={1}>
                      {formatLeaves(r.departureAt)} · {r.seatsLeft === 1 ? t('results.seatsLeftOne') : t('results.seatsLeftMany', { count: r.seatsLeft })}
                    </Text>
                  </View>
                  <View style={styles.priceCol}>
                    <Text style={[styles.price, tc.color_text]}>{money(r.price)}</Text>
                    <Text style={[styles.perSeat, tc.color_textSec]}>{t('results.perSeat')}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* ── Book bar ─────────────────────────────────────────── */}
        {rides.length > 0 && (
          <View style={[styles.bookBar, { paddingBottom: insets.bottom + Spacing.md }, tc.borderTopColor_border]}>
            <View style={styles.barRow}>
              <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={seats === 1 ? t('search.seatOne') : t('search.seatMany', { count: seats })}>
                <Icon name="account-outline" size={20} color={tk.text} />
                <Pressable
                  onPress={() => setSeats(s => Math.max(1, s - 1))}
                  disabled={seats <= 1}
                  accessibilityRole="button"
                  accessibilityLabel={t('results.fewer')}
                  hitSlop={6}
                  style={[styles.stepBtn, { opacity: seats <= 1 ? 0.4 : 1 }, tc.borderColor_border]}
                >
                  <Icon name="minus" size={18} color={tk.text} />
                </Pressable>
                <Text style={[styles.stepValue, tc.color_text]}>{seats === 1 ? t('search.seatOne') : t('search.seatMany', { count: seats })}</Text>
                <Pressable
                  onPress={() => setSeats(s => Math.min(maxSeats, s + 1))}
                  disabled={seats >= maxSeats}
                  accessibilityRole="button"
                  accessibilityLabel={t('results.more')}
                  hitSlop={6}
                  style={[styles.stepBtn, { opacity: seats >= maxSeats ? 0.4 : 1 }, tc.borderColor_border]}
                >
                  <Icon name="plus" size={18} color={tk.text} />
                </Pressable>
              </View>
              <View style={[styles.barDivider, tc.backgroundColor_border]} />
              <Pressable
                onPress={() => selected && navigation.navigate('RideDetail', { rideId: selected.id, ...riderStops })}
                disabled={!selected}
                accessibilityRole="button"
                accessibilityLabel={t('results.detailsLabel')}
                style={styles.detailsBtn}
              >
                <Icon name="information-outline" size={20} color={tk.text} />
                <Text style={[styles.detailsText, tc.color_text]}>{t('results.details')}</Text>
                <Icon name="chevron-right" size={20} color={tk.text} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => selected && navigation.navigate('Booking', { rideId: selected.id, seats, ...riderStops })}
              disabled={!canBook}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canBook }}
              style={[styles.bookBtn, canBook ? tc.backgroundColor_primary : tc.backgroundColor_border]}
            >
              <Text style={[styles.bookText, canBook ? tc.color_textOnPrimary : tc.color_textSec]}>
                {selected
                  ? canBook
                    ? t('results.book', { vehicle: VEHICLE_CATEGORIES[selected.category].label, price: money(selected.price * seats) })
                    : selected.seatsLeft === 1 ? t('results.onlyLeftOne') : t('results.onlyLeftMany', { count: selected.seatsLeft })
                  : t('results.choose')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={[
        styles.chip,
        on ? tc.borderColor_primary : tc.borderColor_border,
        on ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
      ]}
    >
      {icon && <Icon name={icon} size={16} color={on ? tk.primary : tk.textSec} />}
      <Text style={[styles.chipText, on ? tc.color_primary : tc.color_text]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trackedLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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

  altBanner: { borderRadius: Radius.lg, padding: Spacing.md, gap: 4, marginBottom: Spacing.sm },
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
