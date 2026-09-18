import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { userService } from '../../services/userService';
import { bookingService } from '../../services/bookingService';
import { rideService } from '../../services/rideService';
import type { Booking, Ride } from '../../types/api';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleToggle } from '../../components/RoleToggle';
import type { RootStackParamList } from '../../navigation/types';
import { Icon, type IconName } from '../../components/Icon';
import { Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── Helpers ────────────────────────────────────────────────────── */
const AnimatedPressable = ({
  onPress,
  style,
  children,
}: {
  onPress?: () => void;
  style?: any;
  children: React.ReactNode;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  return (
    <Pressable accessibilityRole="button" onPressIn={onIn} onPressOut={onOut} onPress={onPress}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Data will be fetched from APIs

/* ═══════════════════════════════════════════════════════════════════ */
export function DriverHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [loadError, setLoadError] = useState(false);

  const [driverName, setDriverName] = useState('');
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [ridesToday, setRidesToday] = useState(0);

  interface UpcomingRide {
    id: string;
    from: string;
    to: string;
    date: string;
    time: string;
    booked: number;
    total: number;
    earned: number;
  }

  const [pendingCount, setPendingCount] = useState(0);
  const [upcomingRides, setUpcomingRides] = useState<UpcomingRide[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchDashboardData = async () => {
        try {
          const [userProfile, completedRes, pendingRes, ridesRes] = await Promise.all([
            userService.getMyProfile(),
            bookingService.getDriverBookings(1, 100, 'completed'),
            bookingService.getDriverBookings(1, 50, 'pending'),
            rideService.getMyRides(undefined, 1, 20),
          ]);
          if (!isActive) return;

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

          const upcoming = (ridesRes.data?.items ?? []).filter(
            (r: Ride) => r.status === 'scheduled' || r.status === 'active',
          );
          setUpcomingRides(upcoming.map((r: Ride) => {
            const departure = new Date(r.scheduledDeparture);
            const booked = (r.seats ?? 0) - (r.availableSeats ?? 0);
            return {
              id: r._id,
              from: r.pickupLocation?.address || 'Pickup',
              to: r.dropoffLocation?.address || 'Drop',
              date: departure.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
              time: departure.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              booked,
              total: r.seats ?? 0,
              earned: booked * r.pricePerSeat,
            };
          }));
          setLoadError(false);
        } catch {
          if (isActive) setLoadError(true);
        }
      };

      fetchDashboardData();
      return () => { isActive = false; };
    }, [])
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Gradient Header ────────────────────────────────────── */}
        <LinearGradient
          colors={[c.primaryDark, c.primary]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Row 1: Name | Trust + Bell */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.driverName}>{driverName}</Text>
            </View>

            <View style={styles.headerRight}>
              {/* Bell */}
              <Pressable
                onPress={() => navigation.navigate('Notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                style={styles.bellBtn}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path
                    d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                    fill="white"
                  />
                </Svg>
              </Pressable>
            </View>
          </View>

          {/* Row 2: RoleToggle */}
          <RoleToggle />

          {/* Earnings card */}
          <AnimatedPressable onPress={() => navigation.navigate('Earnings')}>
          <View style={styles.earningsCard} accessibilityRole="button" accessibilityLabel="View earnings">
            <View style={styles.flex1}>
              <Text style={styles.earningsLabel}>Earned today</Text>
              <Text style={styles.earningsValue}>₹{todayEarnings.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={[styles.flex1, { alignItems: 'center' }]}>
              <Text style={styles.earningsLabel}>Rides today</Text>
              <Text style={styles.earningsValue}>{ridesToday}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={[styles.flex1, { alignItems: 'center' }]}>
              <Text style={styles.earningsLabel}>Rating</Text>
              <Text style={styles.earningsValue}>{rating ? rating.avg.toFixed(1) : 'New'}</Text>
              <Text style={styles.earningsSubLabel}>
                {rating ? `${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}
              </Text>
            </View>
          </View>
          </AnimatedPressable>
        </LinearGradient>

        {loadError && (
          <View style={styles.sectionPad}>
            <Text style={{ fontSize: 14, color: c.error }}>
              Some of your dashboard could not be loaded. Check your connection.
            </Text>
          </View>
        )}

        {/* ── Pending requests banner (online only) ─────────── */}
        {pendingCount > 0 && (
          <View style={styles.sectionPad}>
            <AnimatedPressable onPress={() => navigation.navigate('ManageRequests' as unknown as never)}>
              <View style={[styles.pendingBanner, { backgroundColor: c.surface, borderColor: c.accent }]}>
                <View style={[styles.pendingIcon, { backgroundColor: c.accent + '22' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24">
                    <Path
                      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                      fill={c.accent}
                    />
                  </Svg>
                </View>
                <View style={styles.flex1}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Pending Requests</Text>
                  <Text style={{ fontSize: 13, color: c.textSec, marginTop: 1 }}>
                    {pendingCount} {pendingCount === 1 ? 'rider is' : 'riders are'} waiting for your response
                  </Text>
                </View>
                <View style={[styles.countCircle, { backgroundColor: c.accent }]}>
                  <Text style={styles.countText}>{pendingCount}</Text>
                </View>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill={c.textSec} />
                </Svg>
              </View>
            </AnimatedPressable>
          </View>
        )}

        {/* ── Upcoming rides ─────────────────────────────────── */}
        {(
        <View style={styles.sectionPad}>
          <View style={styles.sectionHeader}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Upcoming Rides</Text>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('UpcomingRides')}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Manage</Text>
            </Pressable>
          </View>

          {upcomingRides.length === 0 && !loadError && (
            <View style={[styles.upcomingCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 14, color: c.textSec }}>You have no upcoming rides. Create one to start taking bookings.</Text>
            </View>
          )}
          {upcomingRides.map(r => (
            <AnimatedPressable key={r.id} onPress={() => navigation.navigate('DriverRideDetails', { rideId: r.id })} style={{ marginBottom: 12 }}>
              <View style={[styles.upcomingCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={styles.upcomingRow}>
                  <View style={[styles.clockIcon, { backgroundColor: c.primaryLight }]}>
                    <Svg width={18} height={18} viewBox="0 0 24 24">
                      <Path
                        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
                        fill={c.primary}
                      />
                    </Svg>
                  </View>

                  <View style={styles.flex1}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
                      {r.from} to {r.to}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.textSec, marginTop: 3 }}>
                      {r.date} · {r.time}
                    </Text>
                    <View style={styles.seatsRow}>
                      <Svg width={13} height={13} viewBox="0 0 24 24">
                        <Path
                          d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                          fill={c.textSec}
                        />
                      </Svg>
                      <Text style={{ fontSize: 12, color: c.textSec, marginLeft: 4 }}>
                        {r.booked}/{r.total} booked
                      </Text>
                      <Text style={{ fontSize: 12, color: c.textSec, marginHorizontal: 4 }}>·</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: c.success }}>
                        ₹{r.earned} from booked seats
                      </Text>
                    </View>
                  </View>

                  <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginTop: 10 }}>
                    <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill={c.textSec} />
                  </Svg>
                </View>
              </View>
            </AnimatedPressable>
          ))}
        </View>
        )}

        {/* ── Quick Actions ──────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 12 }}>
            Quick Actions
          </Text>
          <View style={styles.actionsGrid}>
            {([
              { icon: 'road-variant', label: 'Create ride', nav: 'CreateRide', bg: c.primaryLight, fg: c.primary },
              { icon: 'cash', label: 'Earnings', nav: 'Earnings', bg: c.successLight, fg: c.successDark },
              { icon: 'card-account-details-outline', label: 'Verification', nav: 'KYC', bg: c.warningLight, fg: '#8A5A00' },
              { icon: 'alert', label: 'SOS', nav: 'SOS', bg: c.errorLight, fg: c.error },
            ] as { icon: IconName; label: string; nav: string; bg: string; fg: string }[]).map(item => (
              <AnimatedPressable key={item.label} onPress={() => navigation.navigate(item.nav as never)} style={{ flex: 1 }}>
                <View style={[styles.actionCard, { backgroundColor: item.bg }]} accessibilityRole="button" accessibilityLabel={item.label}>
                  <Icon name={item.icon} size={32} color={item.fg} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: item.fg, textAlign: 'center' }}>{item.label}</Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      </ScrollView>
      
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  /* Header */
  headerGradient: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  driverName: { fontSize: 20, fontWeight: '800', color: 'white', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  /* Trust ring */

  /* Bell */
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Earnings */
  earningsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    gap: 12,
  },
  earningsLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  earningsValue: { fontSize: 28, fontWeight: '800', color: 'white' },
  earningsSubLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  earningsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  /* Online */

  /* Pending */
  sectionPad: { paddingHorizontal: 20, paddingTop: 20 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    ...Shadow.sm,
  },
  pendingIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  countCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 13, fontWeight: '800', color: 'white' },

  /* Upcoming */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  upcomingCard: { borderRadius: 16, borderWidth: 1, padding: 14, ...Shadow.sm },
  upcomingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  clockIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  seatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },

  /* Quick actions */
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  actionCard: { borderRadius: 14, padding: 20, paddingVertical: 24, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 120 },

});
