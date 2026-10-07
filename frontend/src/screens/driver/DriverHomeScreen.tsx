/**
 * screens/driver/DriverHomeScreen.tsx
 *
 * Map-first home for drivers, matching the rider home: the driver's area on
 * top, and a sheet that scrolls up over it with the "offer a ride" action,
 * today's numbers, riders waiting for an answer, upcoming rides and shortcuts.
 */

import React, { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { ServiceAreaBanner } from '../../components/ServiceArea';
import { Text } from '../../components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveMap } from '../../components/LiveMap';
import { ServiceTile, TileGrid } from '../../components/ServiceTile';
import { Icon, type IconName } from '../../components/Icon';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { userService } from '../../services/userService';
import { bookingService } from '../../services/bookingService';
import { rideService } from '../../services/rideService';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import { logger } from '../../utils/logger';
import type { Booking, Ride } from '../../types/api';
import { REGION, money } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

import { tc, tk } from '../../theme/themed';

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
  const time = d.toLocaleTimeString(REGION.dateLocale, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return i18n.t('home.today', { time });
  if (d.toDateString() === tomorrow.toDateString()) return i18n.t('home.tomorrow', { time });
  return `${d.toLocaleDateString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

export function DriverHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
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
          from: r.pickupLocation?.address || t('common.pickup'),
          to: r.dropoffLocation?.address || t('common.drop'),
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
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load(() => active);
      return () => { active = false; };
    }, [load]),
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? t('driverHome.goodAfternoon') : t('driverHome.goodEvening');
  const firstName = driverName.split(' ')[0];

  const areaLabel =
    hereStatus === 'ready'
      ? here?.address ?? t('home.currentLocation')
      : hereStatus === 'loading'
        ? t('home.findingLocation')
        : hereStatus === 'denied'
          ? t('driverHome.allowLocation')
          : t('home.noLocation');

  const offerRide = () => navigation.navigate('DriverTabs', { screen: 'CreateRide' });

  return (
    <View style={[styles.root, tc.backgroundColor_surface]}>
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
        <View style={[styles.sheet, tc.backgroundColor_surface]}>
          <View style={[styles.handle, tc.backgroundColor_border]} />

          <Text style={[styles.greeting, tc.color_textSec]}>
            {greeting}{firstName ? `, ${firstName}` : ''}
          </Text>

          <ServiceAreaBanner />

          {/* Offer a ride */}
          <Pressable
            onPress={offerRide}
            accessibilityRole="button"
            accessibilityLabel={t('driverHome.offerARide')}
            style={({ pressed }) => [
              styles.offerPill,
              { opacity: pressed ? 0.85 : 1 },
              tc.backgroundColor_surface,
              tc.borderColor_border,
              Shadow.md
            ]}
          >
            <Icon name="steering" size={26} color={tk.text} />
            <Text style={[styles.offerText, tc.color_text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {t('driverHome.whereAreYouDriving')}
            </Text>
            <View style={[styles.offerChip, tc.backgroundColor_primary]}>
              <Icon name="plus" size={18} color={tk.textOnPrimary} />
              <Text style={[styles.offerChipText, tc.color_textOnPrimary]}>{t('driverHome.offer')}</Text>
            </View>
          </Pressable>

          {/* Today */}
          {!loaded ? (
            <ActivityIndicator style={styles.loader} color={tk.primary} accessibilityLabel={t('driverHome.loadingYourDashboard')} />
          ) : loadError ? (
            <Pressable
              onPress={() => load()}
              accessibilityRole="button"
              style={[styles.banner, tc.backgroundColor_errorLight, tc.borderColor_errorLight]}
            >
              <Icon name="alert-circle-outline" size={22} color={tk.error} />
              <Text style={[styles.flex1, tc.color_text]}>{t('driverHome.yourDashboardCouldntBeLoaded')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => navigation.navigate('Earnings')}
              accessibilityRole="button"
              accessibilityLabel={t('driverHome.todayLabel', { amount: money(todayEarnings), rides: ridesToday === 1 ? t('driverHome.rideOne') : t('driverHome.rideMany', { count: ridesToday }) })}
              style={[styles.statsCard, tc.borderColor_border]}
            >
              <Stat label={t('driverHome.earnedToday')} value={`${money(todayEarnings)}`} />
              <View style={[styles.statDivider, tc.backgroundColor_border]} />
              <Stat label={t('driverHome.ridesToday')} value={String(ridesToday)} />
              <View style={[styles.statDivider, tc.backgroundColor_border]} />
              <Stat
                label={rating ? (rating.count === 1 ? t('common.ratingOne') : t('common.ratingMany', { count: rating.count })) : t('common.rating')}
                value={rating ? rating.avg.toFixed(1) : '5.0'}
                icon="star"
              />
            </Pressable>
          )}

          {/* Riders waiting */}
          {pendingCount > 0 && (
            <Pressable
              onPress={() => navigation.navigate('DriverTabs', { screen: 'ManageRequests' })}
              accessibilityRole="button"
              accessibilityLabel={t('driverHome.requestsLabel', { requests: pendingCount === 1 ? t('driverHome.requestOne') : t('driverHome.requestMany', { count: pendingCount }) })}
              style={[
                styles.banner,
                tc.backgroundColor_primaryLight,
                tc.borderColor_primaryLight
              ]}
            >
              <View style={[styles.bannerIcon, tc.backgroundColor_surface]}>
                <Icon name="account-clock-outline" size={22} color={tk.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.bannerLabel, tc.color_primary]}>{t('driverHome.needsYourAnswer')}</Text>
                <Text style={[styles.bannerTitle, tc.color_text]}>
                  {pendingCount} {pendingCount === 1 ? 'rider is' : 'riders are'} waiting
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color={tk.textSec} />
            </Pressable>
          )}

          {/* Upcoming rides */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline, tc.color_text]}>{t('driverHome.yourRides')}</Text>
            {upcomingRides.length > 0 && (
              <Pressable
                onPress={() => navigation.navigate('UpcomingRides')}
                accessibilityRole="button"
                accessibilityLabel={t('driverHome.seeAllYourRides')}
                hitSlop={8}
              >
                <Text style={[styles.link, tc.color_primary]}>{t('driverHome.seeAll')}</Text>
              </Pressable>
            )}
          </View>
          {loaded && upcomingRides.length === 0 && !loadError ? (
            <Text style={[styles.hint, tc.color_textSec]}>
              {t('driverHome.noRidesComingUpOffer')}
            </Text>
          ) : (
            upcomingRides.slice(0, MAX_UPCOMING).map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => navigation.navigate('DriverRideDetails', { rideId: r.id })}
                accessibilityRole="button"
                accessibilityLabel={t('driverHome.rideLabel', { to: r.to, when: formatDeparture(r.departure), booked: r.booked, total: r.total })}
                style={[
                  styles.rideRow,
                  i < Math.min(upcomingRides.length, MAX_UPCOMING) - 1 && [styles.dashed, tc.borderColor_border],
                ]}
              >
                <View style={[styles.rideIcon, tc.backgroundColor_surfaceVariant]}>
                  <Icon name="car-clock" size={22} color={tk.primary} />
                </View>
                <View style={styles.flex1}>
                  <Text style={[styles.rideTitle, tc.color_text]} numberOfLines={1}>{t('driverHome.to', { place: r.to })}</Text>
                  <Text style={[styles.rideSub, tc.color_textSec]} numberOfLines={1}>
                    {formatDeparture(r.departure)} · from {r.from}
                  </Text>
                  <Text style={[styles.rideSub, tc.color_textSec]}>
                    {r.booked}/{r.total} seats booked
                    {r.earned > 0 ? <Text style={[{ fontWeight: Typography.semibold }, tc.color_success]}>{`  ·  ${money(r.earned)}`}</Text> : null}
                  </Text>
                </View>
                <Icon name="chevron-right" size={22} color={tk.textSec} />
              </Pressable>
            ))
          )}

          {/* Shortcuts */}
          <Text style={[styles.sectionTitle, tc.color_text]}>{t('driverHome.driveWithSiham')}</Text>
          <TileGrid>
            <ServiceTile icon="oncomingAutomobile" label={t('driverHome.offerRide')} onPress={offerRide} />
            <ServiceTile icon="moneyBag" label={t('driverHome.earnings')} onPress={() => navigation.navigate('Earnings')} />
            <ServiceTile icon="identificationCard" label={t('driverHome.verify')} onPress={() => navigation.navigate('KYC')} />
            <ServiceTile icon="shield" label={t('driverHome.safety')} onPress={() => navigation.navigate('SOS')} />
          </TileGrid>
        </View>
      </ScrollView>

      {/* ── Floating area pill and bell over the map ─────────── */}
      <View style={[styles.topBar, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
        <Pressable
          onPress={() => (hereStatus === 'ready' ? undefined : refreshHere(true))}
          disabled={hereStatus === 'ready' || hereStatus === 'loading'}
          accessibilityRole="button"
          accessibilityLabel={t('driverHome.areaLabel', { area: areaLabel })}
          style={[styles.locationPill, tc.backgroundColor_surface, Shadow.md]}
        >
          {hereStatus === 'loading' ? (
            <ActivityIndicator size="small" color={tk.primary} />
          ) : (
            <View style={[styles.pickupDot, hereStatus === 'ready' ? tc.borderColor_success : tc.borderColor_warning]} />
          )}
          <Text style={[styles.locationText, tc.color_text]} numberOfLines={1}>{areaLabel}</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Notifications')}
          accessibilityRole="button"
          accessibilityLabel={t('driverHome.notifications')}
          style={[styles.roundBtn, tc.backgroundColor_surface, Shadow.md]}
        >
          <Icon name="bell-outline" size={22} color={tk.text} />
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {icon && <Icon name={icon} size={18} color={icon === 'star' ? tk.star : tk.text} />}
        <Text style={[styles.statValue, tc.color_text]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
      <Text style={[styles.statLabel, tc.color_textSec]} numberOfLines={1}>{label}</Text>
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

});
