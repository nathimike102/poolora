/**
 * screens/driver/DriverHomeScreen.tsx
 *
 * Map-first home for drivers, matching the rider home: the driver's area on
 * top, and a sheet that scrolls up over it with the "offer a ride" action,
 * today's numbers, riders waiting for an answer, upcoming rides and shortcuts.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { LiveMap } from '../../components/LiveMap';
import { Icon, type IconName } from '../../components/Icon';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { userService } from '../../services/userService';
import { bookingService } from '../../services/bookingService';
import { rideService } from '../../services/rideService';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import { logger } from '../../utils/logger';
import type { Booking, Ride } from '../../types/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX_UPCOMING = 3;

interface UpcomingRide {
  id: string;
  from: string;
  to: string;
  departure: string;
  booked: number;
  total: number;
  earned: number;
}

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

export function DriverHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mapHeight = Math.round(height * 0.32);
  const { place: here, status: hereStatus, refresh: refreshHere } = useCurrentPlace();

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [ridesToday, setRidesToday] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [upcomingRides, setUpcomingRides] = useState<UpcomingRide[]>([]);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      const [userProfile, completedRes, pendingRes, ridesRes] = await Promise.all([
        userService.getMyProfile(),
        bookingService.getDriverBookings(1, 100, 'completed'),
        bookingService.getDriverBookings(1, 50, 'pending'),
        rideService.getMyRides(undefined, 1, 20),
      ]);
      if (!isActive()) return;

      setDriverName(userProfile.name);
      const stats = userProfile.stats;
      setRating(stats && stats.totalRatingsAsDriver > 0
        ? { avg: stats.avgRatingAsDriver, count: stats.totalRatingsAsDriver }
        : null);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const today = (completedRes.data?.items ?? []).filter(
        (b: Booking) => new Date(b.updatedAt) >= startOfToday,
      );
      setRidesToday(today.length);
      setTodayEarnings(today.reduce((sum: number, b: Booking) => sum + (b.driverEarnings ?? 0), 0));

      setPendingCount(pendingRes.data?.total ?? pendingRes.data?.items?.length ?? 0);

      const upcoming = (ridesRes.data?.items ?? [])
        .filter((r: Ride) => r.status === 'scheduled' || r.status === 'active')
        .sort((a: Ride, b: Ride) => new Date(a.scheduledDeparture).getTime() - new Date(b.scheduledDeparture).getTime());
      setUpcomingRides(upcoming.map((r: Ride) => {
        const booked = (r.seats ?? 0) - (r.availableSeats ?? 0);
        return {
          id: r._id,
          from: r.pickupLocation?.address || 'Pickup',
          to: r.dropoffLocation?.address || 'Drop',
          departure: r.scheduledDeparture,
          booked,
          total: r.seats ?? 0,
          earned: booked * r.pricePerSeat,
        };
      }));
      setLoadError(false);
    } catch (error) {
      logger.error('Failed to load the driver dashboard', { error });
      if (isActive()) setLoadError(true);
    } finally {
      if (isActive()) setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load(() => active);
      return () => { active = false; };
    }, [load]),
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = driverName.split(' ')[0];

  const areaLabel =
    hereStatus === 'ready'
      ? here?.address ?? 'Current location'
      : hereStatus === 'loading'
        ? 'Finding your location…'
        : hereStatus === 'denied'
          ? 'Allow location to see your area'
          : "Couldn't find your location";

  const offerRide = () => navigation.navigate('DriverTabs', { screen: 'CreateRide' });

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

          <Text style={[styles.greeting, { color: c.textSec }]}>
            {greeting}{firstName ? `, ${firstName}` : ''}
          </Text>

          {/* Offer a ride */}
          <Pressable
            onPress={offerRide}
            accessibilityRole="button"
            accessibilityLabel="Offer a ride"
            style={({ pressed }) => [
              styles.offerPill,
              { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
              Shadow.md,
            ]}
          >
            <Icon name="steering" size={26} color={c.text} />
            <Text style={[styles.offerText, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Where are you driving?
            </Text>
            <View style={[styles.offerChip, { backgroundColor: c.primary }]}>
              <Icon name="plus" size={18} color={c.textOnPrimary} />
              <Text style={[styles.offerChipText, { color: c.textOnPrimary }]}>Offer</Text>
            </View>
          </Pressable>

          {/* Today */}
          {!loaded ? (
            <ActivityIndicator style={styles.loader} color={c.primary} accessibilityLabel="Loading your dashboard" />
          ) : loadError ? (
            <Pressable
              onPress={() => load()}
              accessibilityRole="button"
              style={[styles.banner, { backgroundColor: c.errorLight, borderColor: c.errorLight }]}
            >
              <Icon name="alert-circle-outline" size={22} color={c.error} />
              <Text style={[styles.flex1, { color: c.text }]}>Your dashboard couldn't be loaded. Tap to retry.</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => navigation.navigate('Earnings')}
              accessibilityRole="button"
              accessibilityLabel={`Today: ₹${todayEarnings} earned from ${ridesToday} ${ridesToday === 1 ? 'ride' : 'rides'}. View earnings`}
              style={[styles.statsCard, { borderColor: c.border }]}
            >
              <Stat label="Earned today" value={`₹${todayEarnings.toLocaleString('en-IN')}`} />
              <View style={[styles.statDivider, { backgroundColor: c.border }]} />
              <Stat label="Rides today" value={String(ridesToday)} />
              <View style={[styles.statDivider, { backgroundColor: c.border }]} />
              <Stat
                label={rating ? `${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'}` : 'Rating'}
                value={rating ? rating.avg.toFixed(1) : 'New'}
                icon={rating ? 'star' : undefined}
              />
            </Pressable>
          )}

          {/* Riders waiting */}
          {pendingCount > 0 && (
            <Pressable
              onPress={() => navigation.navigate('DriverTabs', { screen: 'ManageRequests' })}
              accessibilityRole="button"
              accessibilityLabel={`${pendingCount} ${pendingCount === 1 ? 'request' : 'requests'} waiting. Review requests`}
              style={[styles.banner, { backgroundColor: c.primaryLight, borderColor: c.primaryLight }]}
            >
              <View style={[styles.bannerIcon, { backgroundColor: c.surface }]}>
                <Icon name="account-clock-outline" size={22} color={c.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.bannerLabel, { color: c.primary }]}>Needs your answer</Text>
                <Text style={[styles.bannerTitle, { color: c.text }]}>
                  {pendingCount} {pendingCount === 1 ? 'rider is' : 'riders are'} waiting
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color={c.textSec} />
            </Pressable>
          )}

          {/* Upcoming rides */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline, { color: c.text }]}>Your rides</Text>
            {upcomingRides.length > 0 && (
              <Pressable
                onPress={() => navigation.navigate('UpcomingRides')}
                accessibilityRole="button"
                accessibilityLabel="See all your rides"
                hitSlop={8}
              >
                <Text style={[styles.link, { color: c.primary }]}>See all</Text>
              </Pressable>
            )}
          </View>
          {loaded && upcomingRides.length === 0 && !loadError ? (
            <Text style={[styles.hint, { color: c.textSec }]}>
              No rides coming up. Offer one and riders going your way can book your empty seats.
            </Text>
          ) : (
            upcomingRides.slice(0, MAX_UPCOMING).map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => navigation.navigate('DriverRideDetails', { rideId: r.id })}
                accessibilityRole="button"
                accessibilityLabel={`Ride to ${r.to}, ${formatDeparture(r.departure)}, ${r.booked} of ${r.total} seats booked`}
                style={[
                  styles.rideRow,
                  i < Math.min(upcomingRides.length, MAX_UPCOMING) - 1 && [styles.dashed, { borderColor: c.border }],
                ]}
              >
                <View style={[styles.rideIcon, { backgroundColor: c.surfaceVariant }]}>
                  <Icon name="car-clock" size={22} color={c.primary} />
                </View>
                <View style={styles.flex1}>
                  <Text style={[styles.rideTitle, { color: c.text }]} numberOfLines={1}>To {r.to}</Text>
                  <Text style={[styles.rideSub, { color: c.textSec }]} numberOfLines={1}>
                    {formatDeparture(r.departure)} · from {r.from}
                  </Text>
                  <Text style={[styles.rideSub, { color: c.textSec }]}>
                    {r.booked}/{r.total} seats booked
                    {r.earned > 0 ? <Text style={{ color: c.success, fontWeight: Typography.semibold }}>{`  ·  ₹${r.earned.toLocaleString('en-IN')}`}</Text> : null}
                  </Text>
                </View>
                <Icon name="chevron-right" size={22} color={c.textSec} />
              </Pressable>
            ))
          )}

          {/* Shortcuts */}
          <Text style={[styles.sectionTitle, { color: c.text }]}>Drive with Poolora</Text>
          <View style={styles.tileRow}>
            <Tile icon="road-variant" label="Offer ride" onPress={offerRide} />
            <Tile icon="cash" label="Earnings" onPress={() => navigation.navigate('Earnings')} />
            <Tile icon="card-account-details-outline" label="Verify" onPress={() => navigation.navigate('KYC')} />
            <Tile icon="shield-check-outline" label="Safety" onPress={() => navigation.navigate('SOS')} />
          </View>
        </View>
      </ScrollView>

      {/* ── Floating area pill and bell over the map ─────────── */}
      <View style={[styles.topBar, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
        <Pressable
          onPress={() => (hereStatus === 'ready' ? undefined : refreshHere(true))}
          disabled={hereStatus === 'ready' || hereStatus === 'loading'}
          accessibilityRole="button"
          accessibilityLabel={`Your area: ${areaLabel}`}
          style={[styles.locationPill, { backgroundColor: c.surface }, Shadow.md]}
        >
          {hereStatus === 'loading' ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <View style={[styles.pickupDot, { borderColor: hereStatus === 'ready' ? c.success : c.warning }]} />
          )}
          <Text style={[styles.locationText, { color: c.text }]} numberOfLines={1}>{areaLabel}</Text>
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

function Stat({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  const { c } = useApp();
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {icon && <Icon name={icon} size={18} color="#F5B301" />}
        <Text style={[styles.statValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
      <Text style={[styles.statLabel, { color: c.textSec }]} numberOfLines={1}>{label}</Text>
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
  greeting: { fontSize: Typography.lg, fontWeight: Typography.medium, marginBottom: Spacing.md },

  offerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  offerText: { flex: 1, fontSize: Typography['3xl'], fontWeight: Typography.bold },
  offerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  offerChipText: { fontSize: Typography.md, fontWeight: Typography.bold },

  loader: { marginTop: Spacing.xl },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xs },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: Typography['4xl'], fontWeight: Typography.extrabold },
  statLabel: { fontSize: Typography.base, marginTop: 2 },
  statDivider: { width: 1, alignSelf: 'stretch' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  bannerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bannerLabel: { fontSize: Typography.sm, fontWeight: Typography.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
  bannerTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing['2xl'], marginBottom: Spacing.sm },
  sectionTitle: { fontSize: Typography['3xl'], fontWeight: Typography.bold, marginTop: Spacing['2xl'], marginBottom: Spacing.md },
  sectionTitleInline: { marginTop: 0, marginBottom: 0 },
  link: { fontSize: Typography.lg, fontWeight: Typography.bold },
  hint: { fontSize: Typography.md, lineHeight: 20 },

  rideRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.md, minHeight: 72 },
  dashed: { borderBottomWidth: 1, borderStyle: 'dashed' },
  rideIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rideTitle: { fontSize: Typography['2xl'], fontWeight: Typography.semibold },
  rideSub: { fontSize: Typography.md, marginTop: 2 },

  tileRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: { width: '23%', alignItems: 'center', gap: 6 },
  tileIcon: { width: '100%', aspectRatio: 1, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: Typography.base, fontWeight: Typography.semibold },
});
