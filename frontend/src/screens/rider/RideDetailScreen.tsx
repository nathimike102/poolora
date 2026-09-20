import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Animated,
  Linking,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveMap } from '../../components/LiveMap';
import { Icon, type IconName } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { Radius, Shadow } from '../../theme';
import { rideService } from '../../services/rideService';
import type { Ride } from '../../types/api';
import { ActivityIndicator } from 'react-native';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── Helpers ────────────────────────────────────────────────────── */
const AnimatedPressable = ({
  onPress,
  style,
  children,
  accessibilityLabel,
  disabled,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
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
function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const LUGGAGE_LABEL: Record<string, string> = {
  none: 'No luggage',
  small: 'Small bags',
  medium: 'Medium bags',
  large: 'Large bags',
};

export function RideDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [mapExpanded, setMapExpanded] = useState(false);

  const route = useRoute<RouteProp<RootStackParamList, 'RideDetail'>>();
  const rideId = route.params?.rideId;
  const [rideData, setRideData] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchRide = React.useCallback(async () => {
    if (!rideId) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      setRideData(await rideService.getRide(rideId));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  React.useEffect(() => {
    fetchRide();
  }, [fetchRide]);

  if (!loading && (loadError || !rideData)) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <Icon name="car-off" size={40} color={c.textSec} />
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, marginTop: 12 }}>
          We couldn't load this ride
        </Text>
        <Text style={{ fontSize: 14, color: c.textSec, marginTop: 6, textAlign: 'center' }}>
          Check your connection and try again.
        </Text>
        <View style={styles.errorActions}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={[styles.secondaryBtn, { borderColor: c.border }]}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Go back</Text>
          </Pressable>
          <Pressable
            onPress={fetchRide}
            accessibilityRole="button"
            style={[styles.secondaryBtn, { backgroundColor: c.primary, borderColor: c.primary }]}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: c.textOnPrimary }}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ride = rideData;
  const stats = ride?.driver?.stats;
  const ratingCount = stats?.totalRatingsAsDriver ?? 0;
  const tripCount = stats?.totalRidesAsDriver ?? 0;
  const driverName = ride?.driver?.name || 'Driver';
  const joinedYear = ride?.driver?.createdAt ? new Date(ride.driver.createdAt).getFullYear() : null;
  const departure = formatTime(ride?.scheduledDeparture);
  const arrival = formatTime(ride?.estimatedArrival);
  const plate = ride?.vehicle?.plateNumber;
  const vehicleType = ride?.vehicle?.vehicleType;
  const phone = ride?.driver?.phone;

  const origin = ride?.pickupLocation
    ? { latitude: ride.pickupLocation.lat, longitude: ride.pickupLocation.lng }
    : undefined;
  const destination = ride?.dropoffLocation
    ? { latitude: ride.dropoffLocation.lat, longitude: ride.dropoffLocation.lng }
    : undefined;

  const prefs: { icon: IconName; label: string }[] = [];
  if (ride) {
    if (ride.hasAC) prefs.push({ icon: 'snowflake', label: 'AC' });
    if (ride.womenOnly) prefs.push({ icon: 'human-female', label: 'Women only' });
    if (ride.preferences) {
      prefs.push(
        ride.preferences.smokingAllowed
          ? { icon: 'smoking', label: 'Smoking allowed' }
          : { icon: 'smoking-off', label: 'No smoking' },
        ride.preferences.petsAllowed
          ? { icon: 'paw', label: 'Pets allowed' }
          : { icon: 'paw-off', label: 'No pets' },
        { icon: 'bag-suitcase', label: LUGGAGE_LABEL[ride.preferences.luggageSize] ?? 'Luggage' },
      );
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Map ─────────────────────────────────────────────────── */}
      <View style={[styles.mapWrap, { height: mapExpanded ? 250 : 180 }]}>
        <LiveMap showRoute origin={origin} destination={destination} style={StyleSheet.absoluteFill} />

        {/* Header overlay */}
        <View style={styles.mapOverlay}>
          <AnimatedPressable onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <View style={styles.mapBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 5l-7 7 7 7" stroke={c.text} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </View>
          </AnimatedPressable>
        </View>

        {/* Expand / Collapse */}
        <Pressable
          onPress={() => setMapExpanded(!mapExpanded)}
          accessibilityRole="button"
          style={styles.expandBtn}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>
            {mapExpanded ? 'Collapse map' : 'Expand map'}
          </Text>
        </Pressable>
      </View>

      {/* ── Scrollable Content ──────────────────────────────────── */}
      {ride && (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Route info */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.routeDots}>
              <View style={[styles.dot, { backgroundColor: c.primary }]} />
              <View style={[styles.routeLine, { backgroundColor: c.border }]} />
              <View style={[styles.dotSquare, { backgroundColor: c.error }]} />
            </View>

            <View style={styles.flex1}>
              <View style={styles.routeRow}>
                <View style={styles.flex1}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                    {ride.pickupLocation?.address || 'Pickup point'}
                  </Text>
                  {departure && (
                    <Text style={{ fontSize: 12, color: c.textSec }}>Pickup · {departure}</Text>
                  )}
                </View>
                {ride.estimatedDurationMins ? (
                  <View style={[styles.durationBadge, { backgroundColor: c.successLight }]}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: c.success }}>
                      {ride.estimatedDurationMins} min
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.routeRow, { marginTop: 12 }]}>
                <View style={styles.flex1}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                    {ride.dropoffLocation?.address || 'Drop point'}
                  </Text>
                  {arrival && (
                    <Text style={{ fontSize: 12, color: c.textSec }}>Estimated drop · {arrival}</Text>
                  )}
                </View>
                {ride.estimatedDistanceKm ? (
                  <Text style={{ fontSize: 12, color: c.textSec }}>
                    {ride.estimatedDistanceKm.toFixed(1)} km
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* ── Driver card ───────────────────────────────────────── */}
          <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.driverHeader}>
              {ride.driver?.profilePhotoUrl ? (
                <Image
                  source={{ uri: ride.driver.profilePhotoUrl }}
                  style={styles.driverAvatar}
                  accessibilityLabel={`Photo of ${driverName}`}
                />
              ) : (
                <View style={[styles.driverAvatar, styles.centered, { backgroundColor: c.primaryLight }]}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: c.primary }}>
                    {driverName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.flex1}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{driverName}</Text>
                <View style={styles.driverMeta}>
                  {ratingCount > 0 ? (
                    <View style={styles.ratingRow} accessibilityLabel={`Rated ${stats?.avgRatingAsDriver?.toFixed(1)} from ${ratingCount} ratings`}>
                      <StarIcon size={14} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginLeft: 2 }}>
                        {stats?.avgRatingAsDriver?.toFixed(1)}
                      </Text>
                      <Text style={{ fontSize: 13, color: c.textSec, marginLeft: 2 }}>({ratingCount})</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 13, color: c.textSec }}>No ratings yet</Text>
                  )}
                  <Text style={{ fontSize: 13, color: c.textSec }}>
                    {tripCount === 1 ? '1 trip' : `${tripCount} trips`}
                  </Text>
                  {joinedYear && (
                    <Text style={{ fontSize: 13, color: c.textSec }}>Since {joinedYear}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Vehicle */}
            {(plate || vehicleType) && (
              <View style={[styles.vehicleCard, { backgroundColor: c.bg }]}>
                <Icon name="car-side" size={28} color={c.textSec} />
                <View style={styles.flex1}>
                  {vehicleType && (
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textTransform: 'capitalize' }}>
                      {vehicleType}
                    </Text>
                  )}
                  {plate && <Text style={{ fontSize: 12, color: c.textSec }}>{plate}</Text>}
                </View>
                {/* The backend only includes the phone number once your booking is confirmed */}
                {phone && (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${phone}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${driverName}`}
                    style={[styles.phoneBtn, { backgroundColor: c.primaryLight }]}
                  >
                    <Icon name="phone" size={18} color={c.primary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* ── Preferences ───────────────────────────────────────── */}
          {prefs.length > 0 && (
            <View style={styles.mx4}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 }}>
                Ride preferences
              </Text>
              <View style={styles.prefsWrap}>
                {prefs.map(p => (
                  <View
                    key={p.label}
                    style={[styles.prefChip, { backgroundColor: c.surface, borderColor: c.border }]}
                  >
                    <Icon name={p.icon} size={16} color={c.textSec} />
                    <Text style={{ fontSize: 13, color: c.textSec, marginLeft: 6 }}>{p.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Sticky bottom bar ───────────────────────────────────── */}
      {ride && (
        <View style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>₹{ride.pricePerSeat}</Text>
            <Text style={{ fontSize: 12, color: c.textSec }}>
              per seat · {ride.availableSeats} {ride.availableSeats === 1 ? 'seat' : 'seats'} left
            </Text>
          </View>
          <AnimatedPressable
            onPress={() => rideId && navigation.navigate('Booking', { rideId })}
            style={styles.flex1}
            disabled={!rideId || ride.availableSeats < 1}
          >
            <LinearGradient
              colors={[c.primary, c.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.requestBtn, ride.availableSeats < 1 && { opacity: 0.5 }]}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>
                {ride.availableSeats < 1 ? 'Ride full' : 'Request ride'}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      )}
      {loading && (
        <View
          style={[StyleSheet.absoluteFill, styles.centered, { backgroundColor: c.bg }]}
          accessibilityLabel="Loading ride"
        >
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
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  secondaryBtn: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  backgroundColor: "#0B7A75",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 10,
  marginLeft: "auto",
  minWidth: 160,
},
});
