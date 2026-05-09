import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'DriverRideDetails'>;

/* ── Mock data (keyed by id) ────────────────────────────────────── */
const ridesMap: Record<string, {
  id: string; from: string; to: string; date: string; time: string;
  booked: number; total: number; earned: number;
  riders: { name: string; pickup: string; seats: number }[];
}> = {
  '3': {
    id: '3', from: 'Andheri West', to: 'BKC', date: 'Mon, 2 Mar', time: '08:15 AM',
    booked: 3, total: 4, earned: 540,
    riders: [
      { name: 'Priya S.', pickup: 'Andheri Station', seats: 1 },
      { name: 'Arjun K.', pickup: 'DN Nagar Metro', seats: 2 },
    ],
  },
  '4': {
    id: '4', from: 'HSR Layout', to: 'Whitefield', date: 'Tue, 3 Mar', time: '09:00 AM',
    booked: 2, total: 4, earned: 440,
    riders: [
      { name: 'Sneha R.', pickup: 'HSR BDA Complex', seats: 1 },
      { name: 'Vikram M.', pickup: 'Silk Board', seats: 1 },
    ],
  },
  '5': {
    id: '5', from: 'Koramangala', to: 'MG Road', date: 'Wed, 4 Mar', time: '07:30 AM',
    booked: 4, total: 4, earned: 720,
    riders: [
      { name: 'Meera P.', pickup: 'Forum Mall', seats: 2 },
      { name: 'Rahul D.', pickup: 'Sony Signal', seats: 2 },
    ],
  },
  '6': {
    id: '6', from: 'Indiranagar', to: 'Electronic City', date: 'Thu, 5 Mar', time: '08:45 AM',
    booked: 1, total: 4, earned: 380,
    riders: [
      { name: 'Kiran T.', pickup: '100ft Road', seats: 1 },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════ */
export function DriverRideDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const ride = ridesMap[route.params.rideId];

  if (!ride) {
    return (
      <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <BackButton />
          <Text style={[styles.headerTitle, { color: c.text }]}>Ride Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <Text style={{ color: c.textSec, fontSize: 15 }}>Ride not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton />
        <Text style={[styles.headerTitle, { color: c.text }]}>Ride Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Route card */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: c.primary }]} />
            <Text style={[styles.routeText, { color: c.text }]}>{ride.from}</Text>
          </View>
          <View style={[styles.routeLine, { borderColor: c.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: c.success }]} />
            <Text style={[styles.routeText, { color: c.text }]}>{ride.to}</Text>
          </View>
        </View>

        {/* Schedule card */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.sectionLabel, { color: c.textSec }]}>SCHEDULE</Text>
          <View style={styles.infoRow}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path
                d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"
                fill={c.textSec}
              />
            </Svg>
            <Text style={{ fontSize: 14, color: c.text, marginLeft: 8 }}>{ride.date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path
                d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
                fill={c.textSec}
              />
            </Svg>
            <Text style={{ fontSize: 14, color: c.text, marginLeft: 8 }}>{ride.time}</Text>
          </View>
        </View>

        {/* Seats & earnings card */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.sectionLabel, { color: c.textSec }]}>SEATS</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>
                {ride.booked}/{ride.total}
              </Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>booked</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: c.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.sectionLabel, { color: c.textSec }]}>EARNINGS</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.success }}>
                ₹{ride.earned}
              </Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>estimated</Text>
            </View>
          </View>
        </View>

        {/* Riders list */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.sectionLabel, { color: c.textSec, marginBottom: 12 }]}>RIDERS</Text>
          {ride.riders.map((rider, i) => (
            <View
              key={rider.name}
              style={[
                styles.riderRow,
                i < ride.riders.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              ]}
            >
              <View style={[styles.riderAvatar, { backgroundColor: c.primaryLight }]}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>
                  {rider.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.flex1}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{rider.name}</Text>
                <Text style={{ fontSize: 12, color: c.textSec, marginTop: 2 }}>
                  Pickup: {rider.pickup} · {rider.seats} seat{rider.seats > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 44 },
  scrollContent: { padding: 20, gap: 16 },

  /* Card */
  card: { borderRadius: 16, borderWidth: 1, padding: 16, ...Shadow.sm },

  /* Route */
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { fontSize: 15, fontWeight: '700' },
  routeLine: { borderLeftWidth: 2, borderStyle: 'dashed', height: 20, marginLeft: 4 },

  /* Info rows */
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },

  /* Stats */
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 50 },

  /* Riders */
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  riderAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
