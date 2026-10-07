import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Animated,
  Linking,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from '../../components/Themed';
import Svg, { Path } from '../../components/ThemedSvg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveMap } from '../../components/LiveMap';
import { Icon, type IconName } from '../../components/Icon';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import type { RootStackParamList } from '../../navigation/types';
import { Radius, Shadow, Palette } from '../../theme';
import { rideService } from '../../services/rideService';
import type { Ride } from '../../types/api';
import 'react-native';
import { realPhone } from '../../utils/phone';
import { money, REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';

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
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(REGION.dateLocale, { hour: '2-digit', minute: '2-digit' });
}


export function RideDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
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
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
        <Icon name="car-off" size={40} color={tk.textSec} />
        <Text style={[{ fontSize: 17, fontWeight: '700', marginTop: 12 }, tc.color_text]}>
          {t('detail.loadFailed')}
        </Text>
        <Text style={[{ fontSize: 14, marginTop: 6, textAlign: 'center' }, tc.color_textSec]}>
          {t('detail.checkConnection')}
        </Text>
        <View style={styles.errorActions}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={[styles.secondaryBtn, tc.borderColor_border]}
          >
            <Text style={[{ fontSize: 15, fontWeight: '600' }, tc.color_text]}>{t('detail.goBack')}</Text>
          </Pressable>
          <Pressable
            onPress={fetchRide}
            accessibilityRole="button"
            style={[styles.secondaryBtn, tc.backgroundColor_primary, tc.borderColor_primary]}
          >
            <Text style={[{ fontSize: 15, fontWeight: '600' }, tc.color_textOnPrimary]}>{t('detail.tryAgain')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ride = rideData;
  const stats = ride?.driver?.stats;
  const ratingCount = stats?.totalRatingsAsDriver ?? 0;
  const tripCount = stats?.totalRidesAsDriver ?? 0;
  const driverName = ride?.driver?.name || t('detail.driver');
  const joinedYear = ride?.driver?.createdAt ? new Date(ride.driver.createdAt).getFullYear() : null;
  const departure = formatTime(ride?.scheduledDeparture);
  const arrival = formatTime(ride?.estimatedArrival);
  const plate = ride?.vehicle?.plateNumber;
  const vehicleType = ride?.vehicle?.vehicleType;
  const phone = realPhone(ride?.driver?.phone);

  const origin = ride?.pickupLocation
    ? { latitude: ride.pickupLocation.lat, longitude: ride.pickupLocation.lng }
    : undefined;
  const destination = ride?.dropoffLocation
    ? { latitude: ride.dropoffLocation.lat, longitude: ride.dropoffLocation.lng }
    : undefined;

  const prefs: { icon: IconName; label: string }[] = [];
  if (ride) {
    if (ride.hasAC) prefs.push({ icon: 'snowflake', label: t('detail.ac') });
    if (ride.womenOnly) prefs.push({ icon: 'human-female', label: t('detail.womenOnly') });
    if (ride.colleaguesOnly) prefs.push({ icon: 'briefcase-outline', label: t('detail.colleaguesOnly') });
    if (ride.preferences) {
      prefs.push(
        ride.preferences.smokingAllowed
          ? { icon: 'smoking', label: t('detail.smoking') }
          : { icon: 'smoking-off', label: t('detail.noSmoking') },
        ride.preferences.petsAllowed
          ? { icon: 'paw', label: t('detail.pets') }
          : { icon: 'paw-off', label: t('detail.noPets') },
        { icon: 'bag-suitcase', label: t(`detail.luggage.${ride.preferences.luggageSize}`, { defaultValue: t('detail.luggage.any') }) },
      );
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      {/* ── Map ─────────────────────────────────────────────────── */}
      <View style={[styles.mapWrap, { height: mapExpanded ? 250 : 180 }]}>
        <LiveMap showRoute origin={origin} destination={destination} style={StyleSheet.absoluteFill} />

        {/* Header overlay */}
        <View style={styles.mapOverlay}>
          <AnimatedPressable onPress={() => navigation.goBack()} accessibilityLabel={t('detail.goBack')}>
            <View style={styles.mapBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 5l-7 7 7 7" stroke={tk.text} strokeWidth={2.5} strokeLinecap="round" />
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
          <Text style={[{ fontSize: 12, fontWeight: '600' }, tc.color_primary]}>
            {mapExpanded ? t('detail.collapseMap') : t('detail.expandMap')}
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
          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <View style={styles.routeDots}>
              <View style={[styles.dot, tc.backgroundColor_primary]} />
              <View style={[styles.routeLine, tc.backgroundColor_border]} />
              <View style={[styles.dotSquare, tc.backgroundColor_error]} />
            </View>

            <View style={styles.flex1}>
              <View style={styles.routeRow}>
                <View style={styles.flex1}>
                  <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>
                    {ride.pickupLocation?.address || t('detail.pickupPoint')}
                  </Text>
                  {departure && (
                    <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{t('detail.pickupAt', { time: departure })}</Text>
                  )}
                </View>
                {ride.estimatedDurationMins ? (
                  <View style={[styles.durationBadge, tc.backgroundColor_successLight]}>
                    <Text style={[{ fontSize: 12, fontWeight: '600' }, tc.color_success]}>
                      {t('detail.minutes', { count: ride.estimatedDurationMins })}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.routeRow, { marginTop: 12 }]}>
                <View style={styles.flex1}>
                  <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>
                    {ride.dropoffLocation?.address || t('detail.dropPoint')}
                  </Text>
                  {arrival && (
                    <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{t('detail.dropAt', { time: arrival })}</Text>
                  )}
                </View>
                {ride.estimatedDistanceKm ? (
                  <Text style={[{ fontSize: 12 }, tc.color_textSec]}>
                    {ride.estimatedDistanceKm.toFixed(1)} km
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* ── Driver card ───────────────────────────────────────── */}
          <View style={[
            styles.section,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <View style={styles.driverHeader}>
              {ride.driver?.profilePhotoUrl ? (
                <Image
                  source={{ uri: ride.driver.profilePhotoUrl }}
                  style={styles.driverAvatar}
                  accessibilityLabel={t('detail.photoOf', { name: driverName })}
                />
              ) : (
                <View style={[styles.driverAvatar, styles.centered, tc.backgroundColor_primaryLight]}>
                  <Text style={[{ fontSize: 22, fontWeight: '700' }, tc.color_primary]}>
                    {driverName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.flex1}>
                <Text style={[{ fontSize: 17, fontWeight: '700' }, tc.color_text]}>{driverName}</Text>
                {ride.driverVerified ? <VerifiedBadge /> : null}
                {ride.colleagueAt ? (
                  <View style={styles.idChecked}>
                    <Icon name="briefcase-outline" size={14} color={tk.primary} />
                    <Text style={[{ fontSize: 12, fontWeight: '600' }, tc.color_primary]}>{t('detail.worksAt', { company: ride.colleagueAt })}</Text>
                  </View>
                ) : null}
                {ride.trackedCar ? (
                  <View style={styles.idChecked} accessibilityLabel={t('detail.trackedLabel')}>
                    <Icon name="crosshairs-gps" size={14} color={tk.success} />
                    <Text style={[{ fontSize: 12, fontWeight: '600' }, tc.color_success]}>{t('results.tracked')}</Text>
                  </View>
                ) : null}
                {ride.driver?.identity?.status === 'verified' ? (
                  <View style={styles.idChecked} accessibilityLabel={ride.womenOnly ? t('detail.womanDriverLabel') : t('detail.idChecked')}>
                    <Icon name="card-account-details-star-outline" size={14} color={tk.success} />
                    <Text style={[{ fontSize: 12, fontWeight: '600' }, tc.color_success]}>
                      {ride.womenOnly ? t('detail.womanDriver') : t('detail.idChecked')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.driverMeta}>
                  {ratingCount > 0 ? (
                    <View style={styles.ratingRow} accessibilityLabel={t('detail.ratedLabel', { rating: stats?.avgRatingAsDriver?.toFixed(1), count: ratingCount })}>
                      <StarIcon size={14} />
                      <Text style={[{ fontSize: 14, fontWeight: '700', marginLeft: 2 }, tc.color_text]}>
                        {stats?.avgRatingAsDriver?.toFixed(1)}
                      </Text>
                      <Text style={[{ fontSize: 13, marginLeft: 2 }, tc.color_textSec]}>({ratingCount})</Text>
                    </View>
                  ) : (
                    <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{t('detail.noRatings')}</Text>
                  )}
                  <Text style={[{ fontSize: 13 }, tc.color_textSec]}>
                    {tripCount === 1 ? t('detail.tripOne') : t('detail.tripMany', { count: tripCount })}
                  </Text>
                  {joinedYear && (
                    <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{t('detail.since', { year: joinedYear })}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Vehicle */}
            {(plate || vehicleType) && (
              <View style={[styles.vehicleCard, tc.backgroundColor_surface]}>
                <Icon name="car-side" size={28} color={tk.textSec} />
                <View style={styles.flex1}>
                  {vehicleType && (
                    <Text style={[{ fontSize: 14, fontWeight: '600' }, tc.color_text]}>
                      {t(`vehicles.types.${vehicleType}`, { defaultValue: vehicleType })}
                    </Text>
                  )}
                  {plate && <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{plate}</Text>}
                </View>
                {/* The backend only includes the phone number once your booking is confirmed */}
                {phone && (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${phone}`)}
                    accessibilityRole="button"
                    accessibilityLabel={t('detail.call', { name: driverName })}
                    style={[styles.phoneBtn, tc.backgroundColor_primaryLight]}
                  >
                    <Icon name="phone" size={18} color={tk.primary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* ── Preferences ───────────────────────────────────────── */}
          {prefs.length > 0 && (
            <View style={styles.mx4}>
              <Text style={[{ fontSize: 14, fontWeight: '700', marginBottom: 10 }, tc.color_text]}>
                {t('detail.preferences')}
              </Text>
              <View style={styles.prefsWrap}>
                {prefs.map(p => (
                  <View
                    key={p.label}
                    style={[
                      styles.prefChip,
                      tc.backgroundColor_surfaceVariant,
                      tc.borderColor_surfaceVariant
                    ]}
                  >
                    <Icon name={p.icon} size={16} color={tk.textSec} />
                    <Text style={[{ fontSize: 13, marginLeft: 6 }, tc.color_textSec]}>{p.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Sticky bottom bar ───────────────────────────────────── */}
      {ride && (
        <View style={[styles.bottomBar, tc.backgroundColor_surface, tc.borderTopColor_border]}>
          <View>
            <Text style={[{ fontSize: 22, fontWeight: '800' }, tc.color_text]}>{money(ride.pricePerSeat)}</Text>
            <Text style={[{ fontSize: 12 }, tc.color_textSec]}>
              {t('detail.perSeatLeft', { left: ride.availableSeats === 1 ? t('results.seatsLeftOne') : t('results.seatsLeftMany', { count: ride.availableSeats }) })}
            </Text>
          </View>
          <AnimatedPressable
            onPress={() => rideId && navigation.navigate('Booking', { rideId, pickup: route.params?.pickup, dropoff: route.params?.dropoff })}
            style={styles.flex1}
            disabled={!rideId || ride.availableSeats < 1}
          >
            <LinearGradient
              colors={[tk.primary, tk.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.requestBtn, ride.availableSeats < 1 && { opacity: 0.5 }]}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>
                {ride.availableSeats < 1 ? t('detail.full') : t('detail.request')}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      )}
      {loading && (
        <View
          style={[StyleSheet.absoluteFill, styles.centered, tc.backgroundColor_surface]}
          accessibilityLabel={t('detail.loading')}
        >
          <ActivityIndicator size="large" color={tk.primary} />
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
  idChecked: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
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
  backgroundColor: Palette.primary,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 10,
  marginLeft: "auto",
  minWidth: 160,
},
});
