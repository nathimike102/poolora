import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { userService } from '../../services/userService';
import { walletService } from '../../services/walletService';
import { bookingService } from '../../services/bookingService';
import { rideService } from '../../services/rideService';
import type { User, Wallet, Booking, Ride } from '../../types/api';
import { ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle as SvgCircle, Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleToggle } from '../../components/RoleToggle';
import type { RootStackParamList } from '../../navigation/types';
import { Radius, Shadow } from '../../theme';

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
    <Pressable onPressIn={onIn} onPressOut={onOut} onPress={onPress}>
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
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  const [driverName, setDriverName] = useState('Rajesh Kumar');
  const [rating, setRating] = useState(4.9);
  const [earnings, setEarnings] = useState(0);
  const [ridesToday, setRidesToday] = useState(0);
  
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [upcomingRides, setUpcomingRides] = useState<any[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchDashboardData = async () => {
        try {
          setLoading(true);
          
          const [userProfile, wallet, bookingsRes, ridesRes] = await Promise.all([
            userService.getMyProfile().catch(() => null),
            walletService.getBalance().catch(() => null),
            bookingService.getDriverBookings().catch(() => null),
            rideService.getMyRides().catch(() => null)
          ]);
          
          if (isActive) {
            if (userProfile) {
              setDriverName(userProfile.name);
              setRating(userProfile.stats?.avgRatingAsDriver || 4.9);
              setRidesToday(userProfile.stats?.totalRidesAsDriver || 0);
            }
            if (wallet) {
              setEarnings(wallet.totalEarnings || wallet.balance || 0);
            }
            if (bookingsRes) {
              const pending = (bookingsRes.data?.items || []).filter((b: Booking) => b.status === 'pending');
              setPendingRequests(pending.map((b: Booking) => ({
                id: b._id,
                rider: b.rider?.name || 'Rider',
                from: b.pickupLocation?.address || 'Pickup',
                to: b.dropoffLocation?.address || 'Dropoff',
                seats: b.seatsBooked,
                price: b.totalPrice,
                aiScore: 90,
                expiresIn: '—',
                verified: b.rider?.isVerified || false
              })));
            }
            if (ridesRes) {
              const active = (ridesRes.data?.items || []).filter((r: Ride) => r.status === 'active' || r.status === 'draft');
              setUpcomingRides(active.map((r: Ride) => ({
                id: r._id,
                from: r.pickupLocation?.address || 'Pickup',
                to: r.dropoffLocation?.address || 'Dropoff',
                date: new Date(r.scheduledDeparture).toLocaleDateString(),
                time: new Date(r.scheduledDeparture).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                booked: r.seats - r.availableSeats,
                total: r.seats,
                earned: (r.seats - r.availableSeats) * r.pricePerSeat
              })));
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      
      fetchDashboardData();
      return () => { isActive = false; };
    }, [])
  );

  const TRUST = 920;
  const RADIUS = 21;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const TRUST_DASH = CIRCUMFERENCE * 0.92;

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
              <Text style={styles.greeting}>Good morning 🌞</Text>
              <Text style={styles.driverName}>{driverName}</Text>
            </View>

            <View style={styles.headerRight}>
              {/* Trust ring */}
              <View style={styles.trustWrap}>
                <View style={{ width: 52, height: 52 }}>
                  <Svg width={52} height={52} viewBox="0 0 52 52" style={{ transform: [{ rotate: '-90deg' }] }}>
                    <SvgCircle cx={26} cy={26} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={4} />
                    <SvgCircle
                      cx={26}
                      cy={26}
                      r={RADIUS}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeDasharray={`${TRUST_DASH} ${CIRCUMFERENCE}`}
                    />
                  </Svg>
                  <View style={styles.trustLabel}>
                    <Text style={styles.trustScore}>{TRUST}</Text>
                  </View>
                </View>
                <Text style={styles.trustText}>Trust</Text>
              </View>

              {/* Bell */}
              <Pressable
                onPress={() => navigation.navigate('Notifications')}
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
          <AnimatedPressable onPress={() => navigation.navigate('Earnings' as any)}>
          <View style={styles.earningsCard}>
            <View style={styles.flex1}>
              <Text style={styles.earningsLabel}>TODAY'S EARNINGS</Text>
              <Text style={styles.earningsValue}>₹{earnings}</Text>
              <Text style={styles.earningsDelta}>▲ ₹120 vs yesterday</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={[styles.flex1, { alignItems: 'center' }]}>
              <Text style={styles.earningsLabel}>RIDES</Text>
              <Text style={styles.earningsValue}>{ridesToday}</Text>
              <Text style={styles.earningsSubLabel}>Total</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={[styles.flex1, { alignItems: 'center' }]}>
              <Text style={styles.earningsLabel}>RATING</Text>
              <Text style={styles.earningsValue}>{rating}</Text>
              <View style={styles.miniStars}>
                {[1, 2, 3, 4, 5].map(s => (
                  <Svg key={s} width={10} height={10} viewBox="0 0 24 24">
                    <Path
                      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                      fill={s <= 4 ? '#FFB300' : 'rgba(255,255,255,0.3)'}
                    />
                  </Svg>
                ))}
              </View>
            </View>
          </View>
          </AnimatedPressable>

          {/* Online toggle */}
          <View style={styles.onlineRow}>
            <View>
              <Text style={styles.onlineStatus}>
                Status: {isOnline ? '🟢 Online' : '⚫ Offline'}
              </Text>
              <Text style={styles.onlineSub}>
                {isOnline ? 'Receiving new ride requests' : 'Not receiving requests'}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={setIsOnline}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#10B981' }}
              thumbColor="white"
            />
          </View>
        </LinearGradient>

        {/* ── Pending requests banner (online only) ─────────── */}
        {isOnline && pendingRequests.length > 0 && (
          <View style={styles.sectionPad}>
            <AnimatedPressable onPress={() => navigation.navigate('ManageRequests' as any)}>
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
                    {pendingRequests.length} rider{pendingRequests.length > 1 ? 's' : ''} waiting for your response
                  </Text>
                </View>
                <View style={[styles.countCircle, { backgroundColor: c.accent }]}>
                  <Text style={styles.countText}>{pendingRequests.length}</Text>
                </View>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill={c.textSec} />
                </Svg>
              </View>
            </AnimatedPressable>
          </View>
        )}

        {/* ── Upcoming rides (online only) ────────────────────── */}
        {isOnline && (
        <View style={styles.sectionPad}>
          <View style={styles.sectionHeader}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Upcoming Rides</Text>
            <Pressable onPress={() => navigation.navigate('UpcomingRides')}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Manage</Text>
            </Pressable>
          </View>

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
                      {r.from} → {r.to}
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
                        ₹{r.earned} est.
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
              { icon: '🛣️', label: 'Create Ride', nav: 'CreateRide' as const, bg: c.primaryLight, fg: c.primary },
              { icon: '💰', label: 'View Earnings', nav: 'Earnings', bg: c.successLight, fg: c.success },
              { icon: '📋', label: 'Manage KYC', nav: 'KYC', bg: c.warningLight, fg: c.warning },
              { icon: '🚨', label: 'SOS', nav: 'SOS', bg: c.errorLight, fg: c.error },
            ] as { icon: string; label: string; nav: string; bg: string; fg: string }[]).map(item => (
              <AnimatedPressable key={item.label} onPress={() => navigation.navigate(item.nav as any)} style={{ flex: 1 }}>
                <View style={[styles.actionCard, { backgroundColor: item.bg }]}>
                  <Text style={{ fontSize: 36 }}>{item.icon}</Text>
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
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  driverName: { fontSize: 20, fontWeight: '800', color: 'white', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  /* Trust ring */
  trustWrap: { alignItems: 'center', gap: 2 },
  trustLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustScore: { fontSize: 13, fontWeight: '800', color: 'white' },
  trustText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5 },

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
  earningsLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  earningsValue: { fontSize: 28, fontWeight: '800', color: 'white' },
  earningsDelta: { fontSize: 12, color: 'rgba(0,200,83,0.9)' },
  earningsSubLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  earningsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  miniStars: { flexDirection: 'row', gap: 2, marginTop: 4 },

  /* Online */
  onlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  onlineStatus: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  onlineSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

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
