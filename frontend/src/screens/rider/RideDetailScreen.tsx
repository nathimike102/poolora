import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveMap } from '../../components/LiveMap';
import type { RootStackParamList } from '../../navigation/types';
import { Spacing, Radius, Shadow } from '../../theme';
import { rideService } from '../../services/rideService';
import type { Ride } from '../../types/api';
import { ActivityIndicator } from 'react-native';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── Helpers ────────────────────────────────────────────────────── */
const AnimatedPressable = ({
  onPress,
  style,
  children,
}: {
  onPress?: () => void;
  style?: unknown;
  children: React.ReactNode;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
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

const StarIcon = ({ size = 14 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
      fill="#FFB300"
    />
  </Svg>
);

/* ═══════════════════════════════════════════════════════════════════ */
export function RideDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [mapExpanded, setMapExpanded] = useState(false);

  const route = useRoute<RouteProp<RootStackParamList, 'RideDetail'>>();
  const rideId = route.params?.rideId;
  const [rideData, setRideData] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!rideId) {
      setLoading(false);
      return;
    }
    const fetchRide = async () => {
      try {
        const ride = await rideService.getRide(rideId);
        setRideData(ride);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchRide();
  }, [rideId]);

  const driver = {
    name: rideData?.driver?.name || 'Rajesh Kumar',
    avatar: rideData?.driver?.profilePhotoUrl || 'https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=80&h=80&fit=crop',
    rating: rideData?.driver?.stats?.avgRatingAsDriver || 4.9,
    trips: rideData?.driver?.stats?.totalRidesAsDriver || 847,
    vehicle: rideData?.vehicle ? `${rideData.vehicle.make} ${rideData.vehicle.model} · ${rideData.vehicle.color}` : 'Swift Dzire · White',
    plate: rideData?.vehicle?.plateNumber || 'KA 05 AB 1234',
    joinedYear: rideData?.driver?.createdAt ? new Date(rideData.driver.createdAt).getFullYear() : 2022,
    bio: 'Daily commuter from Koramangala to MG Road. Music lover, non-smoker. Very punctual!',
  };
  
  const pickup = rideData?.pickupLocation?.address || 'Koramangala 6th Block';
  const dropoff = rideData?.dropoffLocation?.address || 'MG Road';
  const time = rideData?.scheduledDeparture ? new Date(rideData.scheduledDeparture).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '9:00 AM';
  const price = rideData?.pricePerSeat || 180;

  const reviews = [
    { name: 'Meera P.', rating: 5, text: 'Very punctual and friendly driver. Car was spotless!', date: '2 days ago' },
    { name: 'Arjun V.', rating: 5, text: 'Great ride! Good music, comfortable car.', date: '5 days ago' },
    { name: 'Sneha R.', rating: 4, text: 'On time, safe driving. Recommended.', date: '1 week ago' },
  ];

  const prefs = [
    { icon: '❄️', label: 'AC' },
    { icon: '🚭', label: 'No Smoking' },
    { icon: '🎵', label: 'Music OK' },
    { icon: '🐾', label: 'No Pets' },
    { icon: '👜', label: 'Small Bags' },
    { icon: '💬', label: 'Chat OK' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Map ─────────────────────────────────────────────────── */}
      <View style={[styles.mapWrap, { height: mapExpanded ? 250 : 180 }]}>
        <LiveMap showRoute style={StyleSheet.absoluteFillObject} />

        {/* Header overlay */}
        <View style={styles.mapOverlay}>
          <AnimatedPressable onPress={() => navigation.goBack()}>
            <View style={styles.mapBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 5l-7 7 7 7" stroke={c.text} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </View>
          </AnimatedPressable>

          <View style={{ flex: 1 }} />

          <Pressable style={styles.mapBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
                fill={c.textSec}
              />
            </Svg>
          </Pressable>
        </View>

        {/* Expand / Collapse */}
        <Pressable
          onPress={() => setMapExpanded(!mapExpanded)}
          style={styles.expandBtn}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>
            {mapExpanded ? 'Collapse' : 'Expand Map'}
          </Text>
        </Pressable>
      </View>

      {/* ── Scrollable Content ──────────────────────────────────── */}
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Route info */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {/* Left dots & line */}
          <View style={styles.routeDots}>
            <View style={[styles.dot, { backgroundColor: c.primary }]} />
            <View style={[styles.routeLine, { backgroundColor: c.border }]} />
            <View style={[styles.dotSquare, { backgroundColor: c.error }]} />
          </View>

          <View style={styles.flex1}>
            {/* Pickup */}
            <View style={styles.routeRow}>
              <View style={styles.flex1}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{pickup}</Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>Pickup · {time}</Text>
              </View>
              <View style={[styles.durationBadge, { backgroundColor: c.successLight }]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.success }}>38 min</Text>
              </View>
            </View>

            {/* Drop */}
            <View style={[styles.routeRow, { marginTop: 12 }]}>
              <View style={styles.flex1}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{dropoff}</Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>Drop · 9:38 AM</Text>
              </View>
              <Text style={{ fontSize: 12, color: c.textSec }}>12.4 km</Text>
            </View>
          </View>
        </View>

        {/* ── Driver card ───────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.driverHeader}>
            {/* Avatar with verified badge */}
            <View>
              <Image source={{ uri: driver.avatar }} style={styles.driverAvatar} />
              <View style={[styles.verifiedBadge, { backgroundColor: c.primary }]}>
                <Svg width={10} height={10} viewBox="0 0 24 24">
                  <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white" />
                </Svg>
              </View>
            </View>

            <View style={styles.flex1}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{driver.name}</Text>
              <View style={styles.driverMeta}>
                <View style={styles.ratingRow}>
                  <StarIcon size={14} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginLeft: 2 }}>
                    {driver.rating}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: c.textSec }}>{driver.trips} trips</Text>
                <Text style={{ fontSize: 13, color: c.textSec }}>Since {driver.joinedYear}</Text>
              </View>
              <Text style={{ fontSize: 13, color: c.textSec, marginTop: 6, lineHeight: 18 }}>
                {driver.bio}
              </Text>
            </View>
          </View>

          {/* Vehicle */}
          <View style={[styles.vehicleCard, { backgroundColor: c.bg }]}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1649583221631-d3bade8ba57d?w=120&h=70&fit=crop' }}
              style={styles.vehicleImg}
            />
            <View style={styles.flex1}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{driver.vehicle}</Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>{driver.plate}</Text>
            </View>
            <Pressable style={[styles.phoneBtn, { backgroundColor: c.primaryLight }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path
                  d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                  fill={c.primary}
                />
              </Svg>
            </Pressable>
          </View>
        </View>

        {/* ── Preferences ───────────────────────────────────────── */}
        <View style={styles.mx4}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 }}>
            Ride Preferences
          </Text>
          <View style={styles.prefsWrap}>
            {prefs.map(p => (
              <View
                key={p.label}
                style={[styles.prefChip, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Text style={{ fontSize: 14 }}>{p.icon}</Text>
                <Text style={{ fontSize: 13, color: c.textSec, marginLeft: 4 }}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Reviews ───────────────────────────────────────────── */}
        <View style={styles.mx4mt}>
          <View style={styles.reviewsHeader}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Reviews</Text>
            <View style={styles.ratingRow}>
              <StarIcon size={16} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginLeft: 4 }}>4.9</Text>
              <Text style={{ fontSize: 13, color: c.textSec, marginLeft: 2 }}>(847)</Text>
            </View>
          </View>

          {reviews.map((r, i) => (
            <View
              key={i}
              style={[styles.reviewCard, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <View style={styles.reviewTop}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{r.name}</Text>
                <View style={styles.ratingRow}>
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <StarIcon key={j} size={12} />
                  ))}
                </View>
              </View>
              <Text style={{ fontSize: 13, color: c.textSec, lineHeight: 18 }}>{r.text}</Text>
              <Text style={{ fontSize: 11, color: c.border, marginTop: 6 }}>{r.date}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Sticky bottom bar ───────────────────────────────────── */}
      <View style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>₹{price}</Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>per seat</Text>
        </View>
        <AnimatedPressable
          onPress={() => navigation.navigate('Booking', { rideId: rideId || '1' })}
          style={styles.flex1}
        >
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.requestBtn}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Request Ride</Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
      {loading && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Map */
  mapWrap: { position: 'relative' },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  mapBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  expandBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'white',
    ...Shadow.md,
  },

  /* Scroll */
  scrollContent: { paddingBottom: 120 },

  /* Cards */
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: Radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  mx4: { marginHorizontal: 16, marginTop: 12 },
  mx4mt: { marginHorizontal: 16, marginTop: 16 },

  /* Route */
  routeDots: { alignItems: 'center', gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotSquare: { width: 10, height: 10, borderRadius: 2 },
  routeLine: { width: 1.5, minHeight: 20, flex: 1 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  durationBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },

  /* Driver */
  driverHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  driverAvatar: { width: 60, height: 60, borderRadius: 16 },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },

  /* Vehicle */
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
  },
  vehicleImg: { width: 70, height: 46, borderRadius: 8 },
  phoneBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  /* Preferences */
  prefsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },

  /* Reviews */
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reviewCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    ...Shadow.lg,
  },
  requestBtn: {
  height: 56,
  borderRadius: 12,
  backgroundColor: "#6C3CF0",   // purple theme
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 10,
  marginLeft: "auto", 
  minWidth: 160,

  // Shadow (iOS)
  // shadowColor: "#000",
  // shadowOffset: { width: 0, height: 3 },
  // shadowOpacity: 0.2,
  // shadowRadius: 4,

  // // Shadow (Android)
  // elevation: 5
},
});
