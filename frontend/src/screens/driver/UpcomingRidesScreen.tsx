import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from '../../components/ThemedSvg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';
import { rideService } from '../../services/rideService';
import type { Ride } from '../../types/api';
import { money, REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

import { tc, tk } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

function toUpcoming(r: Ride): UpcomingRide {
  const departure = new Date(r.scheduledDeparture);
  const booked = (r.seats ?? 0) - (r.availableSeats ?? 0);
  return {
    id: r._id,
    from: r.pickupLocation?.address || i18n.t('common.pickup'),
    to: r.dropoffLocation?.address || i18n.t('common.drop'),
    date: departure.toLocaleDateString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' }),
    time: departure.toLocaleTimeString(REGION.dateLocale, { hour: '2-digit', minute: '2-digit' }),
    booked,
    total: r.seats ?? 0,
    earned: booked * r.pricePerSeat,
  };
}

/* ═══════════════════════════════════════════════════════════════════ */
export function UpcomingRidesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [rides, setRides] = useState<UpcomingRide[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      rideService
        .getMyRides(undefined, 1, 50)
        .then(res => {
          if (!active) return;
          const upcoming = (res.data?.items ?? [])
            .filter(r => r.status === 'scheduled' || r.status === 'active')
            .sort((a, b) => a.scheduledDeparture.localeCompare(b.scheduledDeparture));
          setRides(upcoming.map(toUpcoming));
          setLoadError(false);
        })
        .catch(() => active && setLoadError(true));
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('upcomingRides.upcomingRides')} />

      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {rides === null && !loadError && <ActivityIndicator color={tk.primary} style={{ marginTop: 24 }} />}
        {loadError && (
          <Text style={[{ fontSize: 14, textAlign: 'center' }, tc.color_error]}>
            {t('upcomingRides.yourRidesCouldNotBe')}
          </Text>
        )}
        {rides?.length === 0 && (
          <Text style={[{ fontSize: 14, textAlign: 'center', marginTop: 24 }, tc.color_textSec]}>
            {t('upcomingRides.youHaveNoUpcomingRides')}
          </Text>
        )}
        {rides?.map(r => <RideCard key={r.id} ride={r} />)}
      </ScrollView>
    </View>
  );
}

/* ── Ride Card ──────────────────────────────────────────────────── */
function RideCard({ ride }: { ride: UpcomingRide }) {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(1)).current;

  const onIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={() => navigation.navigate('DriverRideDetails', { rideId: ride.id })}
      accessibilityRole="button"
      accessibilityLabel={`${ride.from} to ${ride.to}, ${ride.date} ${ride.time}, ${ride.booked} of ${ride.total} seats booked`}
    >
      <Animated.View
        style={[
          styles.card,
          { transform: [{ scale }] },
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}
      >
        <View style={styles.cardRow}>
          {/* Clock icon */}
          <View style={[styles.clockIcon, tc.backgroundColor_primaryLight]}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
                fill={tk.primary}
              />
            </Svg>
          </View>

          {/* Ride info */}
          <View style={styles.flex1}>
            <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]}>
              {t('upcomingRides.route', { from: ride.from, to: ride.to })}
            </Text>
            <Text style={[{ fontSize: 12, marginTop: 3 }, tc.color_textSec]}>
              {ride.date} · {ride.time}
            </Text>
            <View style={styles.seatsRow}>
              <Svg width={13} height={13} viewBox="0 0 24 24">
                <Path
                  d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                  fill={tk.textSec}
                />
              </Svg>
              <Text style={[{ fontSize: 12, marginLeft: 4 }, tc.color_textSec]}>
                {ride.booked}/{ride.total} booked
              </Text>
              <Text style={[{ fontSize: 12, marginHorizontal: 4 }, tc.color_textSec]}>·</Text>
              <Text style={[{ fontSize: 12, fontWeight: '600' }, tc.color_success]}>
                {money(ride.earned)} from booked seats
              </Text>
            </View>
          </View>

          {/* Chevron */}
          <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginTop: 10 }}>
            <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill={tk.textSec} />
          </Svg>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 44 },
  scrollContent: { padding: 20, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, ...Shadow.sm },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  clockIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  seatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
});
