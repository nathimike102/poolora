/**
 * screens/rider/RideResultsScreen.tsx
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  FlatList,
  LayoutAnimation,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { Icon } from '../../components/Icon';
import type { Ride as ApiRide, PaginatedResponse } from '../../types/api';


type NavProp = NativeStackNavigationProp<RootStackParamList, 'RideResults'>;
type RideResultsRoute = RouteProp<RootStackParamList, 'RideResults'>;

// RideResultsScreen now accepts `route.params.rides` (passed from SearchScreen).
// The incoming payload may be a paginated response or a plain array; map it safely to the UI shape.

type RatingFilter = 0 | 3.5 | 4 | 4.5;
type SortBy = 'ai' | 'price' | 'rating' | 'time';

// ─── Custom Toggle Switch ─────────────────────────────────────────────────────

function ToggleSwitch({
  value,
  onChange,
  color,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  color: string;
  label: string;
}) {
  const translateX = useRef(new Animated.Value(value ? 21 : 0)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: value ? 21 : 0,
      useNativeDriver: true,
      stiffness: 500,
      damping: 35,
    }).start();
  }, [value, translateX]);

  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      activeOpacity={0.8}
      onPress={() => onChange(!value)}
      style={[
        styles.toggleTrack,
        { backgroundColor: value ? color : '#D1D5DB' },
      ]}
    >
      <Animated.View
        style={[
          styles.toggleKnob,
          { transform: [{ translateX }] },
        ]}
      />
    </TouchableOpacity>
  );
}

// ─── AnimatedPressable ────────────────────────────────────────────────────────

function AnimatedPressable({
  onPress,
  scaleValue = 0.98,
  style,
  children,
}: {
  onPress: () => void;
  scaleValue?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: scaleValue, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }, [scale, scaleValue]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scale]);

  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={1} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

// ─── Sort pill labels ─────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'ai', label: 'Best match' },
  { key: 'price', label: 'Lowest price' },
  { key: 'rating', label: 'Highest rated' },
  { key: 'time', label: 'Earliest' },
];

const RATING_OPTIONS: { label: string; value: RatingFilter }[] = [
  { label: 'Any', value: 0 },
  { label: '3.5+', value: 3.5 },
  { label: '4+', value: 4 },
  { label: '4.5+', value: 4.5 },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function RideResultsScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RideResultsRoute>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [sortBy, setSortBy] = useState<SortBy>('ai');
  const [showFilter, setShowFilter] = useState(false);

  // Filter states
  const [activeFilters, setActiveFilters] = useState({
    womenOnly: false,
    acOnly: false,
    minRating: 0 as RatingFilter,
  });
  const [draftFilters, setDraftFilters] = useState({ ...activeFilters });

  // Bottom sheet animation
  const sheetY = useRef(new Animated.Value(600)).current;

  const openFilter = useCallback(() => {
    setDraftFilters({ ...activeFilters });
    setShowFilter(true);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, stiffness: 380, damping: 38 }).start();
  }, [activeFilters, sheetY]);

  const closeFilter = useCallback(() => {
    Animated.spring(sheetY, { toValue: 600, useNativeDriver: true, stiffness: 380, damping: 38 }).start(() => {
      setShowFilter(false);
    });
  }, [sheetY]);

  const applyFilter = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveFilters({ ...draftFilters });
    closeFilter();
  }, [draftFilters, closeFilter]);

  const resetFilter = useCallback(() => {
    setDraftFilters({ womenOnly: false, acOnly: false, minRating: 0 });
  }, []);

  const hasActiveFilters =
    activeFilters.womenOnly || activeFilters.acOnly || activeFilters.minRating > 0;

  const handleSortChange = useCallback((s: SortBy) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSortBy(s);
  }, []);

  const searched = route.params?.route;

  // Normalize incoming rides for the UI
  const incoming = route.params?.rides as PaginatedResponse<ApiRide> | ApiRide[] | undefined;

  const normalizedSource = useMemo(() => {
    let arr: unknown[] = [];
    if (Array.isArray(incoming)) {
      arr = incoming;
    } else if (incoming && 'data' in incoming && incoming.data) {
      arr = incoming.data.items || [];
    }
    return (arr as ApiRide[]).map(r => {
      const stats = r.driver?.stats;
      const prefs: string[] = [];
      if (r.hasAC) prefs.push('AC');
      if (r.preferences && !r.preferences.smokingAllowed) prefs.push('No smoking');
      if (r.preferences?.petsAllowed) prefs.push('Pets allowed');
      return {
        id: r._id,
        driver: r.driver?.name || 'Driver',
        avatar: r.driver?.profilePhotoUrl,
        rating: stats?.avgRatingAsDriver ?? 0,
        ratingCount: stats?.totalRatingsAsDriver ?? 0,
        trips: stats?.totalRidesAsDriver ?? 0,
        vehicle: r.vehicle?.vehicleType ?? '',
        from: r.pickupLocation?.address || '',
        to: r.dropoffLocation?.address || '',
        departureAt: r.scheduledDeparture ?? '',
        departure: r.scheduledDeparture ? new Date(r.scheduledDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        arrival: r.estimatedArrival ? new Date(r.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        seats: r.availableSeats ?? 0,
        price: r.pricePerSeat ?? 0,
        aiScore: typeof r.matchScore === 'number' ? Math.round(r.matchScore) : null,
        prefs,
        womenOnly: r.womenOnly ?? false,
      };
    });
  }, [incoming]);

  // Compute filtered + sorted rides
  const rides = useMemo(() => {
    let list = normalizedSource.filter(r => {
      if (activeFilters.womenOnly && !r.womenOnly) return false;
      if (activeFilters.acOnly && !r.prefs.includes('AC')) return false;
      if (activeFilters.minRating > 0 && r.rating < activeFilters.minRating) return false;
      return true;
    });
    if (sortBy === 'ai') list = [...list].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));
    else if (sortBy === 'price') list = [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sortBy === 'rating') list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (sortBy === 'time') list = [...list].sort((a, b) => a.departureAt.localeCompare(b.departureAt));
    return list;
  }, [sortBy, activeFilters, normalizedSource]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.headerTopRow}>
          {/* Back */}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: c.bg, borderColor: c.border }]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth={2.5} strokeLinecap="round">
              <Path d="M19 12H5M12 5l-7 7 7 7" />
            </Svg>
          </TouchableOpacity>

          {/* Route summary */}
          <View style={styles.flex1}>
            {searched ? (
              <>
                <Text style={[styles.routeName, { color: c.text }]} numberOfLines={1}>{searched.from}</Text>
                <Text style={[styles.routeMeta, { color: c.textSec }]} numberOfLines={1}>
                  to {searched.to} · {searched.seats} {searched.seats === 1 ? 'seat' : 'seats'}
                </Text>
              </>
            ) : (
              <Text style={[styles.routeName, { color: c.text }]}>Available rides</Text>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Filters"
            activeOpacity={0.7}
            onPress={openFilter}
            style={[
              styles.filterBtn,
              {
                backgroundColor: hasActiveFilters ? c.primary : c.primaryLight,
                borderColor: hasActiveFilters ? c.primaryDark : c.primary + '40',
              },
            ]}
          >
            <Svg width={19} height={19} viewBox="0 0 24 24" fill={hasActiveFilters ? 'white' : c.primary}>
              <Path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
            </Svg>
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {/* Sort pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {SORT_OPTIONS.map(s => (
            <TouchableOpacity accessibilityRole="button"
              key={s.key}
              activeOpacity={0.7}
              onPress={() => handleSortChange(s.key)}
              style={[
                styles.sortPill,
                {
                  backgroundColor: sortBy === s.key ? c.primary : c.bg,
                  borderColor: sortBy === s.key ? c.primary : c.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.sortPillText,
                  { color: sortBy === s.key ? 'white' : c.textSec },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Results count ─────────────────────────────────────────── */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: c.textSec }]}>
          <Text style={[styles.countBold, { color: c.text }]}>
            {rides.length} {rides.length === 1 ? 'ride' : 'rides'}
          </Text>{' '}
          found
        </Text>
        {hasActiveFilters && (
          <View style={[styles.filterActiveBadge, { backgroundColor: c.primaryLight, borderColor: c.primary + '30' }]}>
            <Text style={[styles.filterActiveText, { color: c.primary }]}>Filters active</Text>
          </View>
        )}
      </View>

      {/* ── Ride Cards ────────────────────────────────────────────── */}
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        style={styles.flex1}
        contentContainerStyle={styles.cardsContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="car-search" size={48} color={c.textSec} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              {hasActiveFilters ? 'No rides match your filters' : 'No rides found for this route and time'}
            </Text>
            {!hasActiveFilters && (
              <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center', marginTop: 6 }}>
                Try a different time. Rides within 2 hours of your chosen time are shown.
              </Text>
            )}
            {hasActiveFilters && (
            <TouchableOpacity accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setActiveFilters({ womenOnly: false, acOnly: false, minRating: 0 });
              }}
              style={[styles.clearBtn, { backgroundColor: c.primaryLight, borderColor: c.primary + '40' }]}
            >
              <Text style={[styles.clearBtnText, { color: c.primary }]}>Clear filters</Text>
            </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item: ride }) => (
          <AnimatedPressable
            scaleValue={0.98}
            onPress={() => navigation.navigate('RideDetail', { rideId: ride.id })}
            style={[
              styles.rideCard,
              { backgroundColor: c.surface, borderColor: c.border, ...Shadow.sm },
            ]}
          >
            <View style={styles.cardContent}>
              {/* Driver info row */}
              <View style={styles.driverRow}>
                {/* Avatar */}
                {ride.avatar ? (
                  <Image source={{ uri: ride.avatar }} style={styles.avatar} resizeMode="cover" />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: c.primary }}>{ride.driver.charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                {/* Name + badges + meta */}
                <View style={styles.flex1}>
                  <View style={styles.driverNameRow}>
                    <Text style={[styles.driverName, { color: c.text }]}>{ride.driver}</Text>
                    {ride.womenOnly && (
                      <View style={[styles.tagBadge, { backgroundColor: '#FFF1F2' }]}>
                        <Text style={[styles.tagText, { color: '#9F1239' }]}>Women only</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.driverMetaRow}>
                    {ride.ratingCount > 0 ? (
                      <View style={styles.ratingRow} accessibilityLabel={`Rated ${ride.rating.toFixed(1)}`}>
                        <Svg width={13} height={13} viewBox="0 0 24 24" fill="#FFB300">
                          <Path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </Svg>
                        <Text style={[styles.ratingText, { color: c.text }]}>{ride.rating.toFixed(1)}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.metaText, { color: c.textSec }]}>New driver</Text>
                    )}
                    <Text style={[styles.metaText, { color: c.textSec }]}>{ride.trips} {ride.trips === 1 ? 'trip' : 'trips'}</Text>
                    <Text style={[styles.metaText, { color: c.textSec }]}>{ride.vehicle}</Text>
                  </View>
                </View>

                {/* Match score from the matching engine */}
                {ride.aiScore !== null && (
                <View
                  style={[
                    styles.aiBox,
                    {
                      backgroundColor:
                        ride.aiScore >= 90 ? c.successLight
                        : ride.aiScore >= 75 ? c.primaryLight
                        : c.warningLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.aiScore,
                      {
                        color:
                          ride.aiScore >= 90 ? c.success
                          : ride.aiScore >= 75 ? c.primary
                          : c.warning,
                      },
                    ]}
                  >
                    {ride.aiScore}
                  </Text>
                  <Text
                    style={[
                      styles.aiLabel,
                      {
                        color:
                          ride.aiScore >= 90 ? c.success
                          : ride.aiScore >= 75 ? c.primary
                          : c.warning,
                      },
                    ]}
                  >
                    match
                  </Text>
                </View>
                )}
              </View>

              {/* Route & timing */}
              <View style={[styles.routeBox, { backgroundColor: c.bg }]}>
                <View style={styles.routeDots}>
                  <View style={[styles.dotFrom, { backgroundColor: c.primary }]} />
                  <View style={[styles.routeConnector, { backgroundColor: c.border }]} />
                  <View style={[styles.dotTo, { backgroundColor: c.error }]} />
                </View>
                <View style={styles.flex1}>
                  <View style={styles.routeLineRow}>
                    <Text style={[styles.routeLocText, { color: c.text }]}>{ride.from}</Text>
                    <Text style={[styles.routeTimeText, { color: c.primary }]}>{ride.departure}</Text>
                  </View>
                  <View style={styles.routeLineRow}>
                    <Text style={[styles.routeLocText, { color: c.text }]}>{ride.to}</Text>
                    <Text style={[styles.arrivalText, { color: c.textSec }]}>{ride.arrival}</Text>
                  </View>
                </View>
              </View>

              {/* Prefs & price */}
              <View style={styles.bottomRow}>
                <View style={styles.prefsRow}>
                  {ride.prefs.slice(0, 2).map((p: string) => (
                    <View key={p} style={[styles.prefChip, { backgroundColor: c.bg, borderColor: c.border }]}>
                      <Text style={[styles.prefText, { color: c.textSec }]}>{p}</Text>
                    </View>
                  ))}
                  {ride.prefs.length > 2 && (
                    <Text style={[styles.prefMore, { color: c.textSec }]}>+{ride.prefs.length - 2}</Text>
                  )}
                </View>
                <View style={styles.priceCol}>
                  <Text style={[styles.priceText, { color: c.text }]}>₹{ride.price}</Text>
                  <Text style={[styles.seatsText, { color: c.textSec }]}>
                    per seat · {ride.seats} {ride.seats === 1 ? 'seat' : 'seats'} left
                  </Text>
                </View>
              </View>
            </View>
          </AnimatedPressable>
        )}
      />

      {/* ══════════════════════════════════════
          FILTER BOTTOM SHEET (Modal)
      ══════════════════════════════════════ */}
      <Modal
        visible={showFilter}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeFilter}
      >
        {/* Scrim */}
        <Pressable accessibilityRole="button" style={styles.scrim} onPress={closeFilter}>
          <View />
        </Pressable>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: sheetY }] },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Title row */}
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close filters" activeOpacity={0.7} onPress={closeFilter} style={styles.sheetCloseBtn}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="#6B7280">
                <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Filter options */}
          <View style={styles.sheetBody}>
            {/* Women-only */}
            <View style={styles.filterRow}>
              <View style={styles.flex1}>
                <Text style={styles.filterLabel}>Women-only rides</Text>
                <Text style={styles.filterDesc}>Rides open only to women passengers</Text>
              </View>
              <ToggleSwitch
                label="Women-only rides"
                value={draftFilters.womenOnly}
                onChange={v => setDraftFilters(d => ({ ...d, womenOnly: v }))}
                color={c.primary}
              />
            </View>

            {/* AC rides */}
            <View style={styles.filterRow}>
              <View style={styles.flex1}>
                <Text style={styles.filterLabel}>AC rides only</Text>
                <Text style={styles.filterDesc}>Only show rides with air conditioning</Text>
              </View>
              <ToggleSwitch
                label="AC rides only"
                value={draftFilters.acOnly}
                onChange={v => setDraftFilters(d => ({ ...d, acOnly: v }))}
                color={c.primary}
              />
            </View>

            {/* Minimum Rating */}
            <View style={styles.filterRow}>
              <View style={styles.ratingHeader}>
                <Text style={styles.filterLabel}>Minimum Rating</Text>
                <Text style={[styles.ratingValue, { color: c.primary }]}>
                  {draftFilters.minRating === 0 ? 'Any' : `${draftFilters.minRating}+`}
                </Text>
              </View>
              <View style={styles.ratingBtns}>
                {RATING_OPTIONS.map(opt => (
                  <TouchableOpacity accessibilityRole="button"
                    key={opt.value}
                    activeOpacity={0.7}
                    onPress={() => setDraftFilters(d => ({ ...d, minRating: opt.value }))}
                    style={[
                      styles.ratingBtn,
                      {
                        borderColor: draftFilters.minRating === opt.value ? c.primary : '#E5E7EB',
                        backgroundColor: draftFilters.minRating === opt.value ? c.primaryLight : 'white',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ratingBtnText,
                        {
                          color: draftFilters.minRating === opt.value ? c.primary : '#6B7280',
                          fontWeight: draftFilters.minRating === opt.value ? Typography.bold : Typography.medium,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.sheetActions}>
            <TouchableOpacity accessibilityRole="button"
              activeOpacity={0.7}
              onPress={resetFilter}
              style={styles.resetBtn}
            >
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <AnimatedPressable
              scaleValue={0.97}
              onPress={applyFilter}
              style={styles.applyBtnWrap}
            >
              <LinearGradient
                colors={[c.primary, c.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.applyBtn, Shadow.primary(c.primary)]}
              >
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </LinearGradient>
            </AnimatedPressable>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  routeName: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  routeMeta: {
    fontSize: Typography.sm,
    marginTop: 2,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: '#F43F5E',
    borderWidth: 2,
    borderColor: 'white',
  },

  // ── Sort pills ──────────────────────────────────────────────────
  sortRow: {
    gap: Spacing.sm,
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortPillText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },

  // ── Count row ───────────────────────────────────────────────────
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  countText: {
    fontSize: Typography.md,
  },
  countBold: {
    fontWeight: Typography.bold,
  },
  filterActiveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterActiveText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },

  // ── Ride Cards ──────────────────────────────────────────────────
  cardsContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  rideCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  surgeBanner: {
    backgroundColor: '#FFF3EE',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  surgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: '#FF8A50',
  },
  cardContent: {
    padding: Spacing.lg,
  },

  // Driver row
  driverRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  driverName: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  tagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: Typography.bold,
  },
  driverMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  metaText: {
    fontSize: Typography.sm,
  },

  // AI Score box
  aiBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiScore: {
    fontSize: Typography.md,
    fontWeight: Typography.extrabold,
  },
  aiLabel: {
    fontSize: 9,
    fontWeight: Typography.semibold,
  },

  // Route box
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  routeDots: {
    alignItems: 'center',
  },
  dotFrom: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  routeConnector: {
    width: 1.5,
    height: 18,
  },
  dotTo: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  routeLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  routeLocText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  routeTimeText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  arrivalText: {
    fontSize: Typography.base,
  },

  // Prefs & price
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  prefChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  prefText: {
    fontSize: Typography.xs,
  },
  prefMore: {
    fontSize: Typography.xs,
    alignSelf: 'center',
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.extrabold,
  },
  seatsText: {
    fontSize: Typography.xs,
  },

  // ── Empty State ─────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 52,
  },
  emptyTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  clearBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  clearBtnText: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },

  // ── Toggle Switch ───────────────────────────────────────────────
  toggleTrack: {
    width: 48,
    height: 27,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 21,
    height: 21,
    borderRadius: Radius.full,
    backgroundColor: 'white',
    ...Shadow.sm,
  },

  // ── Bottom Sheet ────────────────────────────────────────────────
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Shadow.lg,
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: Typography.extrabold,
    color: '#111827',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  filterRow: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: '#111827',
  },
  filterDesc: {
    fontSize: Typography.sm,
    color: '#9CA3AF',
    marginTop: 1,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.md,
  },
  ratingValue: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  ratingBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  ratingBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBtnText: {
    fontSize: Typography.base,
  },

  // ── Sheet Actions ───────────────────────────────────────────────
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  resetBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: '#374151',
  },
  applyBtnWrap: {
    flex: 2,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  applyBtn: {
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: 'white',
  },
});
