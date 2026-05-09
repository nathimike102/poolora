import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Modal,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingService } from '../../services/bookingService';
import { logger } from '../../utils/logger';
import type { Booking } from '../../types/api';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { Radius, Shadow } from '../../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RideTab = 'upcoming' | 'past' | 'cancelled';

interface UpcomingRide {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  driver: string;
  price: number;
  status: 'confirmed' | 'pending';
  driverAvatar: string;
}

interface CancelledRide {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  driver: string;
  price: number;
  reason: string;
  driverAvatar: string;
}

/* ── Helpers ────────────────────────────────────────────────────── */
const AnimatedPressable = ({
  onPress,
  style,
  children,
  disabled,
}: {
  onPress?: () => void;
  style?: any;
  children: React.ReactNode;
  disabled?: boolean;
}) => {
  const scale = useSharedValue(1);
  const onIn = () => { scale.value = withSpring(0.95); };
  const onOut = () => { scale.value = withSpring(1); };
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={onPress}
      disabled={disabled}
    >
      <ReAnimated.View style={[style, animStyle]}>
        {children}
      </ReAnimated.View>
    </Pressable>
  );
};

const StarIcon = ({ size = 13 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
      fill="#FFB300"
    />
  </Svg>
);

/* ── Route dots (pickup → drop) ─────────────────────────────────── */
const RouteDots = ({ pickupColor, dropColor, lineColor }: { pickupColor: string; dropColor: string; lineColor: string }) => (
  <View style={styles.routeDots}>
    <View style={[styles.routeDot, { backgroundColor: pickupColor }]} />
    <View style={[styles.routeLine, { backgroundColor: lineColor }]} />
    <View style={[styles.routeSquare, { backgroundColor: dropColor }]} />
  </View>
);

/* ── Data ────────────────────────────────────────────────────────── */
const INITIAL_UPCOMING: UpcomingRide[] = [
  {
    id: '1', from: 'Koramangala 6th Block', to: 'MG Road',
    date: 'Today', time: '9:00 AM', driver: 'Rajesh Kumar', price: 180,
    status: 'confirmed',
    driverAvatar: 'https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=60&h=60&fit=crop',
  },
  {
    id: '2', from: 'HSR Layout Sector 1', to: 'Whitefield ITPL',
    date: 'Tomorrow', time: '8:30 AM', driver: 'Anita Sharma', price: 220,
    status: 'pending',
    driverAvatar: 'https://images.unsplash.com/photo-1580746453801-37b0bc56f3b4?w=60&h=60&fit=crop',
  },
];

// We will use state for past rides instead of a constant.

/* ═══════════════════════════════════════════════════════════════════ */
export function MyRidesScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<RideTab>('upcoming');
  const [upcoming, setUpcoming] = useState<UpcomingRide[]>([]);
  const [pastRides, setPastRides] = useState<any[]>([]);
  const [cancelled, setCancelled] = useState<CancelledRide[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchBookings = async () => {
        try {
          setLoading(true);
          const res = await bookingService.getRiderBookings(1, 50);
          if (isActive) {
            const items = res.data?.items || [];
            
            const formatRide = (b: Booking) => ({
              id: b._id,
              from: b.ride?.pickupLocation?.address || 'Pickup Location',
              to: b.ride?.dropoffLocation?.address || 'Dropoff Location',
              date: new Date(b.ride?.scheduledDeparture || new Date()).toLocaleDateString(),
              time: new Date(b.ride?.scheduledDeparture || new Date()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
              driver: b.ride?.driver?.name || 'Driver',
              price: b.totalPrice,
              status: b.status,
              driverAvatar: b.ride?.driver?.profilePhotoUrl || 'https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=60&h=60&fit=crop',
              reason: b.status === 'cancelled' ? 'Cancelled' : '',
              rating: b.ride?.driver?.stats?.avgRatingAsDriver || 5
            });

            setUpcoming(items.filter(b => b.status === 'pending' || b.status === 'confirmed').map(formatRide) as any);
            setPastRides(items.filter(b => b.status === 'completed').map(formatRide));
            setCancelled(items.filter(b => b.status === 'cancelled' || b.status === 'rejected').map(formatRide) as any);
          }
        } catch (error) {
          logger.error('Failed to fetch rider bookings', { error });
        } finally {
          if (isActive) setLoading(false);
        }
      };
      fetchBookings();
      return () => { isActive = false; };
    }, [])
  );

  /* Cancel flow */
  const [cancelTarget, setCancelTarget] = useState<UpcomingRide | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

  const sheetY = useSharedValue(400);
  const scrimOpacity = useSharedValue(0);
  const doneScale = useSharedValue(0);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));
  const scrimAnimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));
  const doneAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: doneScale.value }],
  }));

  const openCancel = (ride: UpcomingRide) => {
    setCancelTarget(ride);
    setCancelDone(false);
    sheetY.value = 400;
    scrimOpacity.value = 0;
    sheetY.value = withSpring(0, { stiffness: 380, damping: 38 });
    scrimOpacity.value = withTiming(1, { duration: 250 });
  };

  const closeCancel = () => {
    sheetY.value = withSpring(400);
    scrimOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => {
      setCancelTarget(null);
      setCancelling(false);
      setCancelDone(false);
    }, 300);
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    setCancelling(true);
    
    bookingService.cancelBooking(cancelTarget.id)
      .then(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setUpcoming(prev => prev.filter(r => r.id !== cancelTarget.id));
        setCancelled(prev => [
          {
            id: cancelTarget.id,
            from: cancelTarget.from,
            to: cancelTarget.to,
            date: cancelTarget.date,
            time: cancelTarget.time,
            driver: cancelTarget.driver,
            price: cancelTarget.price,
            reason: 'Cancelled by you',
            driverAvatar: cancelTarget.driverAvatar,
          },
          ...prev,
        ]);
        setCancelling(false);
        setCancelDone(true);
        doneScale.value = 0;
        doneScale.value = withSpring(1, { damping: 5, stiffness: 100 });
        setTimeout(() => {
          closeCancel();
          setTab('cancelled');
        }, 1400);
      })
      .catch(error => {
        setCancelling(false);
        logger.error('Failed to cancel booking', { error });
      });
  };

  const tabs: { id: RideTab; label: string; count: number }[] = [
    { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { id: 'past', label: 'Completed', count: pastRides.length },
    { id: 'cancelled', label: 'Cancelled', count: cancelled.length },
  ];

  /* ── Upcoming tab ───────────────────────────────────────────────── */
  const renderUpcoming = () => (
    <FlatList
      data={upcoming}
      keyExtractor={(item) => item.id}
      style={styles.flex1}
      contentContainerStyle={styles.listGap}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 52 }}>🎉</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>No upcoming rides</Text>
          <Text style={{ fontSize: 13, color: c.textSec }}>Book your next carpool below!</Text>
        </View>
      }
      renderItem={({ item: r }) => (
        <View style={[styles.rideCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          {/* Status header */}
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: r.status === 'confirmed' ? c.successLight : c.warningLight,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: r.status === 'confirmed' ? c.success : c.warning,
                }}
              >
                {r.status === 'confirmed' ? '● CONFIRMED' : '● AWAITING'}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: c.textSec }}>
              {r.date} · {r.time}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          <View style={styles.cardBody}>
            {/* Route */}
            <View style={styles.routeRow}>
              <RouteDots pickupColor={c.primary} dropColor={c.error} lineColor={c.border} />
              <View style={styles.flex1}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{r.from}</Text>
                <Text style={{ fontSize: 14, color: c.textSec, marginTop: 6 }}>{r.to}</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>₹{r.price}</Text>
            </View>

            {/* Driver + actions */}
            <View style={styles.driverRow}>
              <Image source={{ uri: r.driverAvatar }} style={styles.smallAvatar} />
              <Text style={{ fontSize: 13, color: c.textSec }}>{r.driver}</Text>
              <View style={styles.cardActions}>
                {r.status === 'confirmed' && (
                  <Pressable
                    onPress={() => navigation.navigate('ActiveRide', { rideId: r.id })}
                    style={[styles.actionBtn, { backgroundColor: c.primaryLight }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Track</Text>
                  </Pressable>
                )}
                <AnimatedPressable onPress={() => openCancel(r)}>
                  <View style={[styles.actionBtn, { backgroundColor: c.errorLight }]}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: c.error }}>Cancel</Text>
                  </View>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        </View>
      )}
    />
  );

  /* ── Past tab ───────────────────────────────────────────────────── */
  const renderPast = () => (
    <FlatList
      data={pastRides}
      keyExtractor={(item) => item.id}
      style={styles.flex1}
      contentContainerStyle={styles.listGap}
      showsVerticalScrollIndicator={false}
      renderItem={({ item: r }) => (
        <View style={[styles.pastCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          {/* Route */}
          <View style={styles.routeRow}>
            <RouteDots pickupColor={c.primary} dropColor={c.error} lineColor={c.border} />
            <View style={styles.flex1}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{r.from}</Text>
              <Text style={{ fontSize: 14, color: c.textSec, marginTop: 6 }}>{r.to}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>₹{r.price}</Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>{r.date}</Text>
            </View>
          </View>

          {/* Driver + rating */}
          <View style={styles.driverRow}>
            <Image source={{ uri: r.driverAvatar }} style={styles.tinyAvatar} />
            <Text style={{ fontSize: 13, color: c.textSec }}>{r.driver}</Text>
            <View style={styles.starsRow}>
              {Array.from({ length: r.rating }).map((_, j) => (
                <StarIcon key={j} />
              ))}
            </View>
          </View>

          {/* Action btns */}
          <View style={styles.pastActions}>
            <Pressable style={[styles.pastBtn, { backgroundColor: c.primaryLight }]}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Book Again</Text>
            </Pressable>
            <Pressable style={[styles.pastBtn, { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }]}>
              <Text style={{ fontSize: 13, color: c.textSec }}>Receipt</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );

  /* ── Cancelled tab ──────────────────────────────────────────────── */
  const renderCancelled = () => (
    <FlatList
      data={cancelled}
      keyExtractor={(item) => item.id}
      style={styles.flex1}
      contentContainerStyle={styles.listGap}
      showsVerticalScrollIndicator={false}
      renderItem={({ item: r }) => (
        <View style={[styles.pastCard, { backgroundColor: c.surface, borderColor: c.border, opacity: 0.85 }]}>
          <View style={styles.routeRow}>
            <RouteDots pickupColor={c.textSec} dropColor={c.textSec} lineColor={c.border} />
            <View style={styles.flex1}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{r.from}</Text>
              <Text style={{ fontSize: 14, color: c.textSec, marginTop: 6 }}>{r.to}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.textSec, textDecorationLine: 'line-through' }}>
                ₹{r.price}
              </Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>{r.date}</Text>
            </View>
          </View>

          <View style={[styles.driverRow, { marginBottom: 8 }]}>
            <Image source={{ uri: r.driverAvatar }} style={styles.tinyAvatar} />
            <Text style={{ fontSize: 13, color: c.textSec }}>{r.driver}</Text>
            <Text style={{ fontSize: 12, color: c.textSec, marginLeft: 'auto' }}>{r.time}</Text>
          </View>

          <View style={[styles.reasonBanner, { backgroundColor: c.errorLight }]}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                fill={c.error}
              />
            </Svg>
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.error }}>{r.reason}</Text>
          </View>
        </View>
      )}
    />
  );

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.headerTop}>
          <AnimatedPressable onPress={() => navigation.goBack()}>
            <View style={[styles.backBtn, { backgroundColor: c.bg, borderColor: c.border }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 5l-7 7 7 7" stroke={c.text} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </View>
          </AnimatedPressable>
          <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>My Rides</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tabItem}>
                <View style={styles.tabInner}>
                  <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? c.primary : c.textSec }}>
                    {t.label}
                  </Text>
                  {t.count > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: active ? c.primary : c.border }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: active ? 'white' : c.textSec }}>
                        {t.count}
                      </Text>
                    </View>
                  )}
                </View>
                {active && <View style={[styles.tabIndicator, { backgroundColor: c.primary }]} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Body ────────────────────────────────────────────────── */}
      <View style={styles.flex1}>
        {loading ? (
          <View style={[styles.flex1, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={c.primary} size="large" />
          </View>
        ) : (
          <>
            {tab === 'upcoming' && renderUpcoming()}
            {tab === 'past' && renderPast()}
            {tab === 'cancelled' && renderCancelled()}
          </>
        )}
      </View>

      <Modal visible={!!cancelTarget} transparent animationType="none" onRequestClose={() => !cancelling && closeCancel()}>
        {/* Scrim */}
        <ReAnimated.View style={[styles.scrim, scrimAnimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !cancelling && closeCancel()} />
        </ReAnimated.View>

        {/* Sheet */}
        <ReAnimated.View style={[styles.sheet, sheetAnimStyle]}>
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {cancelDone ? (
            /* ── Success state ── */
            <View style={styles.doneWrap}>
              <ReAnimated.View
                style={[
                  styles.doneCircle,
                  { backgroundColor: c.errorLight },
                  doneAnimStyle,
                ]}
              >
                <Svg width={32} height={32} viewBox="0 0 24 24">
                  <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill={c.error} />
                </Svg>
              </ReAnimated.View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Ride Cancelled</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                Your ride has been successfully cancelled. Redirecting to Cancelled rides…
              </Text>
            </View>
          ) : cancelTarget ? (
            /* ── Confirmation state ── */
            <View>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleRow}>
                  <View style={[styles.sheetIcon, { backgroundColor: c.errorLight }]}>
                    <Svg width={18} height={18} viewBox="0 0 24 24">
                      <Path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                        fill={c.error}
                      />
                    </Svg>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Cancel Ride?</Text>
                </View>
                <Pressable
                  onPress={closeCancel}
                  disabled={cancelling}
                  style={[styles.closeBtn, { opacity: cancelling ? 0.4 : 1 }]}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path
                      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                      fill="#6B7280"
                    />
                  </Svg>
                </Pressable>
              </View>

              <View style={styles.sheetBody}>
                {/* Ride recap card */}
                <View style={styles.recapCard}>
                  <View style={styles.recapTop}>
                    <Image
                      source={{ uri: cancelTarget.driverAvatar }}
                      style={styles.recapAvatar}
                    />
                    <View style={styles.flex1}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>
                        {cancelTarget.driver}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>
                        {cancelTarget.date} · {cancelTarget.time}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>
                      ₹{cancelTarget.price}
                    </Text>
                  </View>
                  <View style={styles.recapDivider} />
                  <View style={styles.recapRoute}>
                    <RouteDots pickupColor={c.primary} dropColor={c.error} lineColor="#D1D5DB" />
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                        {cancelTarget.from}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>
                        {cancelTarget.to}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Policy warning */}
                <View style={styles.policyBanner}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" style={{ flexShrink: 0 } as any}>
                    <Path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="#F59E0B" />
                  </Svg>
                  <View style={styles.flex1}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 2 }}>
                      Cancellation Policy
                    </Text>
                    <Text style={{ fontSize: 12, color: '#92400E', lineHeight: 18 }}>
                      {cancelTarget.status === 'confirmed'
                        ? 'This ride departs soon. A ₹20 cancellation fee may apply.'
                        : "Free cancellation — this ride hasn't been confirmed yet."}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={closeCancel}
                  disabled={cancelling}
                  style={[styles.keepBtn, { opacity: cancelling ? 0.5 : 1 }]}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151' }}>Keep Ride</Text>
                </Pressable>
                <AnimatedPressable
                  onPress={confirmCancel}
                  disabled={cancelling}
                  style={styles.flex1}
                >
                  {cancelling ? (
                    <View style={[styles.cancelConfirmBtn, { backgroundColor: '#FCA5A5' }]}>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: 'white', marginLeft: 8 }}>
                        Cancelling…
                      </Text>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={['#F43F5E', '#E11D48']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cancelConfirmBtn}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: 'white' }}>Yes, Cancel</Text>
                    </LinearGradient>
                  )}
                </AnimatedPressable>
              </View>
            </View>
          ) : null}
        </ReAnimated.View>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Tabs */
  tabRow: { flexDirection: 'row' },
  tabItem: { flex: 1, alignItems: 'center', paddingBottom: 12 },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countBadge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1 },

  /* Scroll */
  scrollContent: { padding: 20, paddingBottom: 100 },
  listGap: { gap: 14, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  /* Empty */
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },

  /* Ride cards */
  rideCard: { borderRadius: 16, borderWidth: 1, ...Shadow.md },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  divider: { height: 1 },
  cardBody: { padding: 16, paddingTop: 14 },

  /* Route dots */
  routeDots: { alignItems: 'center', marginTop: 4, gap: 2 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeSquare: { width: 8, height: 8, borderRadius: 2 },
  routeLine: { width: 1.5, height: 18 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },

  /* Driver row */
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  smallAvatar: { width: 34, height: 34, borderRadius: 10 },
  tinyAvatar: { width: 30, height: 30, borderRadius: 8 },
  cardActions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },

  /* Past */
  pastCard: { borderRadius: 16, borderWidth: 1, padding: 16, ...Shadow.md },
  starsRow: { flexDirection: 'row', gap: 2, marginLeft: 'auto' },
  pastActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  pastBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  /* Cancelled reason */
  reasonBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: Radius.lg },

  /* ── Modal ── */
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 40,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 50,
    ...Shadow.lg,
  },
  handleRow: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },

  /* Done */
  doneWrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, gap: 12 },
  doneCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },

  /* Sheet confirm */
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 16 },
  recapCard: {
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
  },
  recapTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  recapAvatar: { width: 38, height: 38, borderRadius: 10 },
  recapDivider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 12 },
  recapRoute: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },

  policyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: '#FFF3EE',
    borderWidth: 1,
    borderColor: '#FFCBA4',
  },

  sheetActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, width: '100%' },
  keepBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelConfirmBtn: {
    flex: 1,
    height: 52,
    width:120,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
