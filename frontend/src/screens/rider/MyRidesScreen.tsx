/**
 * screens/rider/MyRidesScreen.tsx
 *
 * The rider's bookings. "Upcoming" shows each booked seat as a card with
 * Track and Cancel; "History" is a plain list of finished and cancelled trips,
 * where tapping one starts a new search to the same place.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
} from 'react-native';
import { useNavigation, useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bookingService } from '../../services/bookingService';
import { logger } from '../../utils/logger';
import type { Booking } from '../../types/api';
import { useApp } from '../../context/AppContext';
import type { RootStackParamList, RiderTabParamList } from '../../navigation/types';
import { Icon } from '../../components/Icon';
import { Typography, Spacing, Radius, Shadow } from '../../theme';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<RiderTabParamList, 'MyRides'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type RideTab = 'upcoming' | 'history';

/** Deep enough for white text in both themes (the dark theme's error red is too light) */
const DESTRUCTIVE = '#DC2626';

interface RideItem {
  id: string;
  rideId: string;
  from: string;
  to: string;
  departure: Date | null;
  driver: string;
  price: number;
  status: Booking['status'];
  reason: string;
}

/** "Kakinada Beach, Uppada Road, ..." → "Kakinada Beach" */
function placeName(address: string): string {
  return address.split(',')[0].trim() || address;
}

function formatDate(d: Date | null): string {
  if (!d) return '';
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

function toItem(b: Booking): RideItem {
  const ride = b.ride as unknown as { _id?: string; departureTime?: string } | undefined;
  return {
    id: b._id,
    rideId: ride?._id ?? '',
    from: b.pickup?.address || 'Pickup point',
    to: b.dropoff?.address || 'Drop point',
    departure: ride?.departureTime ? new Date(ride.departureTime) : null,
    driver: b.driver?.name || 'Driver',
    price: b.finalFare ?? b.estimatedFare ?? 0,
    status: b.status,
    reason: b.status === 'rejected' ? 'Declined by driver' : b.cancellationReason || 'Cancelled',
  };
}

export function MyRidesScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<RideTab>('upcoming');
  const [upcoming, setUpcoming] = useState<RideItem[]>([]);
  const [history, setHistory] = useState<RideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      setLoading(true);
      const res = await bookingService.getRiderBookings(1, 50);
      if (!isActive()) return;
      const items = (res.data?.items || []).map(toItem);
      setUpcoming(
        items
          .filter(b => b.status === 'pending' || b.status === 'confirmed')
          .sort((a, b) => (a.departure?.getTime() ?? 0) - (b.departure?.getTime() ?? 0)),
      );
      setHistory(
        items
          .filter(b => b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected')
          .sort((a, b) => (b.departure?.getTime() ?? 0) - (a.departure?.getTime() ?? 0)),
      );
      setLoadError(false);
    } catch (error) {
      logger.error('Failed to fetch rider bookings', { error });
      if (isActive()) setLoadError(true);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load(() => active);
      return () => { active = false; };
    }, [load]),
  );

  /* ── Cancel ─────────────────────────────────────────────────── */
  const [cancelTarget, setCancelTarget] = useState<RideItem | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

  const closeCancel = () => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelDone(false);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await bookingService.cancelBooking(cancelTarget.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setUpcoming(prev => prev.filter(r => r.id !== cancelTarget.id));
      setHistory(prev => [{ ...cancelTarget, status: 'cancelled', reason: 'Cancelled by you' }, ...prev]);
      setCancelDone(true);
    } catch (error) {
      logger.error('Failed to cancel booking', { error });
      Alert.alert('Not cancelled', 'Your booking could not be cancelled. Check your connection and try again.');
    } finally {
      setCancelling(false);
    }
  };

  const rebook = (r: RideItem) =>
    navigation.navigate('Search', { drop: { name: placeName(r.to), subtitle: r.to.split(',').slice(1).join(',').trim() } });

  /* ── Rows ───────────────────────────────────────────────────── */
  const renderUpcoming = ({ item: r }: { item: RideItem }) => {
    const confirmed = r.status === 'confirmed';
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, Shadow.sm]}>
        <View style={styles.cardTop}>
          <View style={[styles.status, { backgroundColor: confirmed ? c.successLight : c.warningLight }]}>
            <Icon name={confirmed ? 'check-circle' : 'clock-outline'} size={14} color={confirmed ? c.successDark : c.text} />
            <Text style={[styles.statusText, { color: confirmed ? c.successDark : c.text }]}>
              {confirmed ? 'Seat confirmed' : 'Waiting for driver'}
            </Text>
          </View>
          <Text style={[styles.price, { color: c.text }]}>₹{r.price}</Text>
        </View>
        <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>{placeName(r.to)}</Text>
        <Text style={[styles.meta, { color: c.textSec }]} numberOfLines={1}>From {r.from}</Text>
        <Text style={[styles.meta, { color: c.textSec }]}>{formatDate(r.departure)} · {r.driver}</Text>
        <View style={styles.actions}>
          {confirmed && r.rideId !== '' && (
            <Pressable
              onPress={() => navigation.navigate('ActiveRide', { rideId: r.rideId, bookingId: r.id })}
              accessibilityRole="button"
              style={[styles.actionBtn, { backgroundColor: c.primary }]}
            >
              <Icon name="map-marker-radius-outline" size={18} color={c.textOnPrimary} />
              <Text style={[styles.actionText, { color: c.textOnPrimary }]}>Track ride</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => { setCancelDone(false); setCancelTarget(r); }}
            accessibilityRole="button"
            accessibilityLabel={`Cancel ride to ${placeName(r.to)}`}
            style={[styles.actionBtn, styles.actionOutline, { borderColor: c.border }]}
          >
            <Text style={[styles.actionText, { color: c.error }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderHistory = ({ item: r, index }: { item: RideItem; index: number }) => {
    const completed = r.status === 'completed';
    return (
      <Pressable
        onPress={() => rebook(r)}
        accessibilityRole="button"
        accessibilityLabel={`${placeName(r.to)}, ${formatDate(r.departure)}, ${completed ? `₹${r.price}, completed` : r.reason}. Book this trip again`}
        style={({ pressed }) => [
          styles.historyRow,
          index < history.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
          pressed && { backgroundColor: c.surfaceVariant },
        ]}
      >
        <View style={[styles.historyIcon, { backgroundColor: c.surfaceVariant }]}>
          <Icon name={completed ? 'map-marker-check-outline' : 'map-marker-remove-outline'} size={22} color={completed ? c.primary : c.textSec} />
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.historyTitle, { color: c.text }]} numberOfLines={1}>{placeName(r.to)}</Text>
          <Text style={[styles.meta, { color: c.textSec }]}>{formatDate(r.departure)}</Text>
          <Text style={[styles.meta, { color: completed ? c.textSec : c.error }]}>
            {completed ? `₹${r.price} · Completed` : `₹0 · ${r.reason}`}
          </Text>
        </View>
        <Icon name="chevron-right" size={22} color={c.textSec} />
      </Pressable>
    );
  };

  const emptyText =
    tab === 'upcoming'
      ? { title: 'No upcoming rides', sub: 'Rides you book will appear here.' }
      : { title: 'No past rides yet', sub: 'Finished and cancelled trips will appear here.' };

  return (
    <View style={[styles.root, { backgroundColor: c.surface, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">My rides</Text>

      <View style={[styles.segment, { backgroundColor: c.surfaceVariant }]} accessibilityRole="tablist">
        {([
          { id: 'upcoming' as const, label: 'Upcoming', count: upcoming.length },
          { id: 'history' as const, label: 'History', count: history.length },
        ]).map(t => {
          const on = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.segmentItem, on && [{ backgroundColor: c.surface }, Shadow.sm]]}
            >
              <Text style={[styles.segmentText, { color: on ? c.text : c.textSec }]}>
                {t.label}{t.count > 0 ? ` ${t.count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && upcoming.length + history.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={c.primary} size="large" accessibilityLabel="Loading your rides" />
      ) : (
        <FlatList
          data={tab === 'upcoming' ? upcoming : history}
          keyExtractor={item => item.id}
          renderItem={tab === 'upcoming' ? renderUpcoming : renderHistory}
          contentContainerStyle={tab === 'upcoming' ? styles.cardList : styles.historyList}
          showsVerticalScrollIndicator={false}
          onRefresh={() => load()}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name={loadError ? 'wifi-off' : 'car-clock'} size={48} color={c.textSec} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                {loadError ? "Your rides couldn't be loaded" : emptyText.title}
              </Text>
              <Text style={[styles.emptySub, { color: c.textSec }]}>
                {loadError ? 'Check your connection and pull down to try again.' : emptyText.sub}
              </Text>
              {!loadError && tab === 'upcoming' && (
                <Pressable
                  onPress={() => navigation.navigate('Search')}
                  accessibilityRole="button"
                  style={[styles.emptyBtn, { backgroundColor: c.primary }]}
                >
                  <Text style={[styles.emptyBtnText, { color: c.textOnPrimary }]}>Find a ride</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* ── Cancel sheet ────────────────────────────────────────── */}
      <Modal visible={Boolean(cancelTarget)} transparent animationType="slide" onRequestClose={closeCancel}>
        <Pressable style={styles.scrim} onPress={closeCancel} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          {cancelDone ? (
            <View style={styles.done} accessibilityLiveRegion="polite">
              <View style={[styles.doneIcon, { backgroundColor: c.successLight }]}>
                <Icon name="check" size={36} color={c.successDark} />
              </View>
              <Text style={[styles.sheetTitle, { color: c.text }]}>Ride cancelled</Text>
              <Text style={[styles.sheetText, { color: c.textSec }]}>Your refund has been started.</Text>
              <Pressable onPress={closeCancel} accessibilityRole="button" style={[styles.sheetBtn, styles.doneBtn, { backgroundColor: c.primary }]}>
                <Text style={[styles.sheetBtnText, { color: c.textOnPrimary }]}>Done</Text>
              </Pressable>
            </View>
          ) : cancelTarget ? (
            <>
              <Text style={[styles.sheetTitle, { color: c.text }]}>Cancel this ride?</Text>
              <View style={[styles.summary, { backgroundColor: c.surfaceVariant }]}>
                <Text style={[styles.historyTitle, { color: c.text }]} numberOfLines={1}>{placeName(cancelTarget.to)}</Text>
                <Text style={[styles.meta, { color: c.textSec }]}>
                  {formatDate(cancelTarget.departure)} · {cancelTarget.driver} · ₹{cancelTarget.price}
                </Text>
              </View>
              <View style={[styles.refund, { backgroundColor: c.infoLight }]}>
                <Icon name="cash-refund" size={20} color={c.info} />
                <Text style={[styles.sheetText, styles.flex1, { color: c.text, textAlign: 'left' }]}>
                  There is no cancellation fee. The full amount goes back to your wallet or original payment method.
                </Text>
              </View>
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={closeCancel}
                  disabled={cancelling}
                  accessibilityRole="button"
                  style={[styles.sheetBtn, styles.flex1, styles.actionOutline, { borderColor: c.border }]}
                >
                  <Text style={[styles.sheetBtnText, { color: c.text }]}>Keep ride</Text>
                </Pressable>
                <Pressable
                  onPress={confirmCancel}
                  disabled={cancelling}
                  accessibilityRole="button"
                  accessibilityState={{ busy: cancelling }}
                  style={[styles.sheetBtn, styles.flex1, { backgroundColor: DESTRUCTIVE }]}
                >
                  {cancelling ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.sheetBtnText, { color: '#FFFFFF' }]}>Yes, cancel</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  title: { fontSize: Typography['6xl'], fontWeight: Typography.extrabold, paddingHorizontal: Spacing.xl, marginTop: Spacing.lg, marginBottom: Spacing.lg },

  segment: { flexDirection: 'row', marginHorizontal: Spacing.xl, padding: 4, borderRadius: Radius.md, gap: 4 },
  segmentItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  segmentText: { fontSize: Typography.lg, fontWeight: Typography.bold },
  loader: { marginTop: Spacing['4xl'] },

  cardList: { padding: Spacing.xl, gap: Spacing.lg, flexGrow: 1 },
  card: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: Typography.sm, fontWeight: Typography.bold },
  price: { fontSize: Typography['3xl'], fontWeight: Typography.extrabold },
  cardTitle: { fontSize: Typography['3xl'], fontWeight: Typography.bold },
  meta: { fontSize: Typography.md, marginTop: 3 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  actionBtn: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  actionOutline: { borderWidth: 1 },
  actionText: { fontSize: Typography.lg, fontWeight: Typography.bold },

  historyList: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl, flexGrow: 1 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.sm },
  historyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: Typography['2xl'], fontWeight: Typography.bold },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing['2xl'], gap: Spacing.sm },
  emptyTitle: { fontSize: Typography['2xl'], fontWeight: Typography.bold, marginTop: Spacing.sm },
  emptySub: { fontSize: Typography.md, textAlign: 'center' },
  emptyBtn: { marginTop: Spacing.lg, minHeight: 48, paddingHorizontal: Spacing['2xl'], borderRadius: Radius.full, justifyContent: 'center' },
  emptyBtnText: { fontSize: Typography.lg, fontWeight: Typography.bold },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: Radius['4xl'], borderTopRightRadius: Radius['4xl'], paddingHorizontal: Spacing.xl },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginVertical: Spacing.md },
  sheetTitle: { fontSize: Typography['3xl'], fontWeight: Typography.extrabold, marginBottom: Spacing.md },
  sheetText: { fontSize: Typography.md, lineHeight: 20, textAlign: 'center' },
  summary: { padding: Spacing.lg, borderRadius: Radius.lg },
  refund: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, marginTop: Spacing.md },
  sheetActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  sheetBtn: { minHeight: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  sheetBtnText: { fontSize: Typography.lg, fontWeight: Typography.bold },
  doneBtn: { alignSelf: 'stretch', marginTop: Spacing.lg },
  done: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  doneIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
});
