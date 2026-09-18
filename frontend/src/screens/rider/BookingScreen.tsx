/**
 * screens/rider/BookingScreen.tsx
 *
 * Confirms a seat request on a ride. Everything shown comes from the ride
 * record; the fare shown is what the backend charges (price per seat x seats).
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Spacing, Radius } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { bookingService } from '../../services/bookingService';
import { rideService } from '../../services/rideService';
import { walletService } from '../../services/walletService';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import type { Ride } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Booking'>;
type BookingRoute = RouteProp<RootStackParamList, 'Booking'>;
type PayMethod = 'razorpay' | 'wallet';

const MAX_SEATS_PER_BOOKING = 4;

function formatDeparture(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function BookingScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<BookingRoute>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const rideId = route.params.rideId;

  const [ride, setRide] = useState<Ride | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [seats, setSeats] = useState(1);
  const [method, setMethod] = useState<PayMethod>('razorpay');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [walletBooked, setWalletBooked] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [r, wallet] = await Promise.all([
        rideService.getRide(rideId),
        walletService.getBalance().catch(() => null),
      ]);
      setRide(r);
      setWalletBalance(wallet?.balance ?? null);
    } catch {
      setLoadError(true);
    }
  }, [rideId]);

  useEffect(() => {
    load();
  }, [load]);

  const maxSeats = Math.max(0, Math.min(ride?.availableSeats ?? 0, MAX_SEATS_PER_BOOKING));
  const total = (ride?.pricePerSeat ?? 0) * seats;
  const walletCovers = walletBalance !== null && walletBalance >= total;

  const handleConfirm = useCallback(async () => {
    if (!ride || isSubmitting) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const result = await bookingService.createBooking({
        rideId,
        seatsBooked: seats,
        // Riders board at the driver's listed pickup point and leave at the listed drop point
        pickup: {
          lat: ride.pickupLocation.lat,
          lng: ride.pickupLocation.lng,
          address: ride.pickupLocation.address ?? '',
        },
        dropoff: {
          lat: ride.dropoffLocation.lat,
          lng: ride.dropoffLocation.lng,
          address: ride.dropoffLocation.address ?? '',
        },
        useWallet: method === 'wallet',
      });

      if (result.paidViaWallet) {
        setWalletBooked(true);
        return;
      }
      if (!result.razorpayOrder || !result.razorpayKeyId) {
        setSubmitError('Card and UPI payments are not available right now. Try paying from your wallet.');
        return;
      }
      navigation.replace('Payment', {
        bookingId: result.booking._id,
        orderId: result.razorpayOrder.id,
        keyId: result.razorpayKeyId,
        amount: result.razorpayOrder.amount / 100,
        summary: `${ride.pickupLocation.address ?? 'Pickup'} to ${ride.dropoffLocation.address ?? 'drop'} · ${seats} ${seats === 1 ? 'seat' : 'seats'}`,
      });
    } catch (error) {
      setSubmitError(errorHandler.process(error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [ride, isSubmitting, rideId, seats, method, navigation]);

  // ── Booked with wallet ──────────────────────────────────────────
  if (walletBooked) {
    return (
      <View style={[styles.centered, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={[styles.confirmedCircle, { backgroundColor: c.success }]}>
          <Icon name="check" size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.confirmedTitle, { color: c.text }]} accessibilityLiveRegion="polite">
          Request sent
        </Text>
        <Text style={[styles.confirmedSub, { color: c.textSec }]}>
          ₹{total.toLocaleString('en-IN')} was paid from your wallet. The driver will confirm your seat,
          and you get a full refund to your wallet if they decline or you cancel.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('RiderTabs', { screen: 'MyRides' })}
          accessibilityRole="button"
          style={[styles.primaryBtn, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>View my rides</Text>
        </Pressable>
      </View>
    );
  }

  // ── Load states ─────────────────────────────────────────────────
  if (loadError || !ride) {
    return (
      <View style={[styles.centered, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        {loadError ? (
          <>
            <Text style={[styles.confirmedTitle, { color: c.text }]}>We couldn't load this ride</Text>
            <Pressable onPress={load} accessibilityRole="button" style={[styles.primaryBtn, { backgroundColor: c.primary }]}>
              <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={c.primary} accessibilityLabel="Loading ride" />
        )}
      </View>
    );
  }

  const stats = ride.driver?.stats;
  const ratingCount = stats?.totalRatingsAsDriver ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: c.text }]}>Confirm booking</Text>
      </View>

      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Ride summary */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.driverRow}>
            {ride.driver?.profilePhotoUrl ? (
              <Image source={{ uri: ride.driver.profilePhotoUrl }} style={styles.driverAvatar} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[styles.driverAvatar, styles.avatarFallback, { backgroundColor: c.primaryLight }]}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: c.primary }}>
                  {(ride.driver?.name ?? 'D').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.flex1}>
              <Text style={[styles.driverName, { color: c.text }]}>{ride.driver?.name ?? 'Driver'}</Text>
              {ride.vehicle?.plateNumber ? (
                <Text style={[styles.driverMeta, { color: c.textSec }]}>{ride.vehicle.plateNumber}</Text>
              ) : null}
            </View>
            <Text style={[styles.driverMeta, { color: c.textSec }]}>
              {ratingCount > 0 ? `${stats?.avgRatingAsDriver?.toFixed(1)} (${ratingCount})` : 'No ratings yet'}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          <Text style={[styles.routeLabel, { color: c.textSec }]}>Pickup</Text>
          <Text style={[styles.routePlace, { color: c.text }]}>{ride.pickupLocation.address}</Text>
          <Text style={[styles.routeTime, { color: c.primary }]}>{formatDeparture(ride.scheduledDeparture)}</Text>
          <Text style={[styles.routeLabel, { color: c.textSec, marginTop: 12 }]}>Drop</Text>
          <Text style={[styles.routePlace, { color: c.text }]}>{ride.dropoffLocation.address}</Text>
        </View>

        <View style={[styles.noteBox, { backgroundColor: c.primaryLight }]}>
          <Icon name="map-marker-radius" size={18} color={c.primary} />
          <Text style={[styles.noteText, { color: c.text }]}>
            You board at the driver's pickup point shown above. Your seat is held once the driver accepts.
          </Text>
        </View>

        {/* Seats */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Seats</Text>
          {maxSeats === 0 ? (
            <Text style={{ color: c.textSec }}>This ride is full.</Text>
          ) : (
            <View style={styles.seatRow} accessibilityRole="radiogroup">
              {Array.from({ length: maxSeats }, (_, i) => i + 1).map(n => {
                const selected = seats === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setSeats(n)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${n} ${n === 1 ? 'seat' : 'seats'}`}
                    style={[
                      styles.seatBtn,
                      { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primaryLight : c.bg },
                    ]}
                  >
                    <Text style={[styles.seatBtnText, { color: selected ? c.primary : c.text }]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Payment method */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Pay with</Text>
          {([
            { id: 'razorpay' as const, label: 'UPI, card or net banking', sub: 'Secure checkout by Razorpay', icon: 'credit-card-outline' as const, enabled: true },
            {
              id: 'wallet' as const,
              label: 'Sanchari wallet',
              sub: walletBalance === null
                ? 'Balance unavailable'
                : `Balance ₹${walletBalance.toLocaleString('en-IN')}${walletCovers ? '' : ' · not enough for this booking'}`,
              icon: 'wallet-outline' as const,
              enabled: walletCovers,
            },
          ]).map(m => {
            const selected = method === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => m.enabled && setMethod(m.id)}
                disabled={!m.enabled}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: !m.enabled }}
                style={[styles.methodRow, { borderColor: selected ? c.primary : c.border, opacity: m.enabled ? 1 : 0.55 }]}
              >
                <Icon name={m.icon} size={22} color={c.textSec} />
                <View style={styles.flex1}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{m.label}</Text>
                  <Text style={{ fontSize: 12, color: c.textSec }}>{m.sub}</Text>
                </View>
                <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={selected ? c.primary : c.textSec} />
              </Pressable>
            );
          })}
        </View>

        {/* Fare */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.fareRow}>
            <Text style={{ fontSize: 14, color: c.textSec }}>
              ₹{ride.pricePerSeat} × {seats} {seats === 1 ? 'seat' : 'seats'}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: c.text }}>₹{total.toLocaleString('en-IN')}</Text>
          </View>
          <Text style={{ fontSize: 12, color: c.textSec, marginTop: 8, lineHeight: 18 }}>
            No extra fees for riders. If the driver declines or you cancel, the full amount is refunded.
          </Text>
        </View>
      </ScrollView>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <View style={[styles.ctaBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        {submitError ? (
          <Text style={[styles.errorText, { color: c.error }]} accessibilityLiveRegion="polite">{submitError}</Text>
        ) : null}
        <Pressable
          onPress={handleConfirm}
          disabled={isSubmitting || maxSeats === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting || maxSeats === 0, busy: isSubmitting }}
          style={[styles.primaryBtn, { backgroundColor: maxSeats === 0 ? c.border : c.primary, marginTop: 0, width: '100%' }]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={c.textOnPrimary} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>
              {method === 'wallet' ? `Pay ₹${total.toLocaleString('en-IN')} from wallet` : `Continue to pay ₹${total.toLocaleString('en-IN')}`}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  confirmedCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  confirmedTitle: { fontSize: Typography['3xl'], fontWeight: Typography.bold, textAlign: 'center' },
  confirmedSub: { fontSize: Typography.md, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: Typography.bold },
  scrollContent: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 140 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg },
  cardTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, marginBottom: Spacing.md },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 48, height: 48, borderRadius: 12 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: Typography.xl, fontWeight: Typography.bold },
  driverMeta: { fontSize: Typography.base },
  divider: { height: 1, marginVertical: Spacing.md },
  routeLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold },
  routePlace: { fontSize: Typography.lg, fontWeight: Typography.semibold, marginTop: 2 },
  routeTime: { fontSize: Typography.base, fontWeight: Typography.semibold, marginTop: 2 },
  noteBox: { flexDirection: 'row', gap: 8, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: Typography.base, lineHeight: 19 },
  seatRow: { flexDirection: 'row', gap: Spacing.sm },
  seatBtn: { width: 56, height: 48, borderRadius: Radius.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  seatBtnText: { fontSize: Typography.xl, fontWeight: Typography.bold },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
    minHeight: 56,
  },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
    borderTopWidth: 1,
  },
  errorText: { fontSize: Typography.base, marginBottom: Spacing.sm, textAlign: 'center' },
  primaryBtn: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
  },
  primaryBtnText: { fontSize: Typography.xl, fontWeight: Typography.bold },
});
