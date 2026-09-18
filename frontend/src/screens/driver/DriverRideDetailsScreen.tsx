/**
 * screens/driver/DriverRideDetailsScreen.tsx
 *
 * A driver's view of one of their rides: route, seats, confirmed riders and
 * the actions to complete or cancel the ride.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';
import { rideService } from '../../services/rideService';
import { bookingService } from '../../services/bookingService';
import type { Booking, Ride } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';

type Route = RouteProp<RootStackParamList, 'DriverRideDetails'>;

export function DriverRideDetailsScreen() {
  const { rideId } = useRoute<Route>().params;
  const navigation = useNavigation();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [ride, setRide] = useState<Ride | null>(null);
  const [riders, setRiders] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, confirmed] = await Promise.all([
        rideService.getRide(rideId),
        bookingService.getDriverBookings(1, 100, 'confirmed'),
      ]);
      setRide(r);
      setRiders(
        (confirmed.data?.items ?? []).filter(b => {
          const bookingRide = b.ride as unknown as { _id?: string } | string | undefined;
          return (typeof bookingRide === 'string' ? bookingRide : bookingRide?._id) === rideId;
        }),
      );
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [rideId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const runAction = (title: string, message: string, confirmLabel: string, action: () => Promise<unknown>) => {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel' },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: async () => {
          setActing(true);
          try {
            await action();
            await load();
          } catch (error) {
            Alert.alert('Something went wrong', errorHandler.process(error).message);
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  };

  const header = (
    <View style={[styles.header, { borderBottomColor: c.border }]}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Ride details</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!ride) {
    return (
      <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          {loadError ? (
            <Text style={{ color: c.textSec, fontSize: 15 }}>This ride could not be loaded.</Text>
          ) : (
            <ActivityIndicator color={c.primary} accessibilityLabel="Loading ride" />
          )}
        </View>
      </View>
    );
  }

  const departure = new Date(ride.scheduledDeparture);
  const booked = (ride.seats ?? 0) - (ride.availableSeats ?? 0);
  const status = ride.status as string;
  const isOpen = status === 'scheduled' || status === 'active' || status === 'in_progress';

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {header}

      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.sectionLabel, { color: c.textSec }]}>Route</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{ride.pickupLocation.address}</Text>
          <Text style={{ fontSize: 14, color: c.textSec, marginVertical: 4 }}>to</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{ride.dropoffLocation.address}</Text>
          <View style={styles.infoRow}>
            <Icon name="calendar" size={16} color={c.textSec} />
            <Text style={{ fontSize: 14, color: c.text, marginLeft: 8 }}>
              {departure.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} at{' '}
              {departure.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="information-outline" size={16} color={c.textSec} />
            <Text style={{ fontSize: 14, color: c.text, marginLeft: 8, textTransform: 'capitalize' }}>
              {status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.sectionLabel, { color: c.textSec }]}>Seats booked</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>
                {booked} of {ride.seats}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: c.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.sectionLabel, { color: c.textSec }]}>Booked fares</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.successDark }}>
                ₹{(booked * ride.pricePerSeat).toLocaleString('en-IN')}
              </Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>before platform fee</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.sectionLabel, { color: c.textSec, marginBottom: 12 }]}>Confirmed riders</Text>
          {riders.length === 0 ? (
            <Text style={{ fontSize: 14, color: c.textSec }}>No confirmed riders yet.</Text>
          ) : (
            riders.map((b, i) => (
              <View
                key={b._id}
                style={[styles.riderRow, i < riders.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}
              >
                <View style={[styles.riderAvatar, { backgroundColor: c.primaryLight }]}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>
                    {(b.rider?.name ?? 'R').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.flex1}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{b.rider?.name ?? 'Rider'}</Text>
                  <Text style={{ fontSize: 12, color: c.textSec, marginTop: 2 }}>
                    {b.seatsBooked} {b.seatsBooked === 1 ? 'seat' : 'seats'}
                    {b.pickup?.address ? ` · Pickup: ${b.pickup.address}` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {isOpen && (
          <View style={styles.actions}>
            <Pressable
              onPress={() =>
                runAction('Complete this ride?', 'Riders will be asked to rate the trip.', 'Complete ride', () =>
                  rideService.completeRide(rideId),
                )
              }
              disabled={acting}
              accessibilityRole="button"
              style={[styles.actionBtn, { backgroundColor: c.primary }]}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>Complete ride</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                runAction(
                  'Cancel this ride?',
                  'All booked riders are notified and fully refunded.',
                  'Cancel ride',
                  () => rideService.cancelRide(rideId),
                )
              }
              disabled={acting}
              accessibilityRole="button"
              style={[styles.actionBtn, { backgroundColor: c.errorLight }]}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.error }}>Cancel ride</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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
  card: { borderRadius: 16, borderWidth: 1, padding: 16, ...Shadow.sm },
  sectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 48, marginHorizontal: 12 },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  riderAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 12 },
  actionBtn: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
