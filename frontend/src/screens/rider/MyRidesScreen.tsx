/**
 * screens/rider/MyRidesScreen.tsx
 *
 * The rider's bookings. "Upcoming" shows each booked seat as a card with
 * Track and Cancel; "History" is a plain list of finished and cancelled trips,
 * where tapping one starts a new search to the same place.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, Modal, Alert, LayoutAnimation } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { EmptyArt } from '../../components/EmptyState';
import { useNavigation, useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bookingService } from '../../services/bookingService';
import { ratingService, type PendingRating } from '../../services/ratingService';
import { logger } from '../../utils/logger';
import type { Booking, CancellationQuote } from '../../types/api';
import type { RootStackParamList, RiderTabParamList } from '../../navigation/types';
import { OptionsSheet, type SheetOption } from '../../components/OptionsSheet';
import { Icon } from '../../components/Icon';
import { ScreenGlow } from '../../components/ScreenGlow';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import { REGION, money } from '../../utils/region';
import { riderPays } from '../../utils/fares';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { tc, tk } from '../../theme/themed';

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
  /** What came back on a cancellation */
  refunded: number;
}

/** "Kakinada Beach, Uppada Road, ..." → "Kakinada Beach" */
function placeName(address: string): string {
  return address.split(',')[0].trim() || address;
}

function formatDate(d: Date | null): string {
  if (!d) return '';
  const date = d.toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(REGION.dateLocale, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(REGION.dateLocale, { hour: 'numeric', minute: '2-digit' });
}

function toItem(b: Booking): RideItem {
  const ride = b.ride as unknown as { _id?: string; departureTime?: string } | undefined;
  return {
    id: b._id,
    rideId: ride?._id ?? '',
    from: b.pickup?.address || i18n.t('myRides.pickupPoint'),
    to: b.dropoff?.address || i18n.t('myRides.dropPoint'),
    departure: ride?.departureTime ? new Date(ride.departureTime) : null,
    driver: b.driver?.name || i18n.t('myRides.driver'),
    // The rider's own part: charges and refunds are on that, not on what a company paid
    price: riderPays(b),
    status: b.status,
    reason: b.noShow ? i18n.t('myRides.reason.noShow') : b.status === 'rejected' ? i18n.t('myRides.reason.declined') : b.cancellationReason || i18n.t('myRides.reason.cancelled'),
    refunded: b.refundAmount ?? 0,
  };
}



/** The refund tiers in words, from the policy the server sent */
function policyText(quote: CancellationQuote | null): string {
  if (!quote?.policy?.length) return i18n.t('myRides.policy.default');
  const parts = quote.policy.map((tier) =>
    tier.minHoursBeforeDeparture > 0
      ? i18n.t('myRides.policy.tier', { percent: tier.refundPercent, hours: tier.minHoursBeforeDeparture })
      : tier.refundPercent ? i18n.t('myRides.policy.after', { percent: tier.refundPercent }) : i18n.t('myRides.policy.nothingAfter'),
  );
  const grace = quote.freeCancelMins ? i18n.t('myRides.policy.grace', { minutes: quote.freeCancelMins }) : '';
  const fee = quote.platformFeeRefundable === false ? i18n.t('myRides.policy.feeKept') : '';
  return i18n.t('myRides.policy.summary', { tiers: parts.join(', '), grace, fee });
}

/** What the rider gets back, in words, for the cancel sheet. */
function refundMessage(quote: CancellationQuote | null): string {
  const policy = policyText(quote);
  if (!quote) return i18n.t('myRides.refund.unknown', { policy });
  if (quote.refundAmount >= quote.fare) {
    const until = quote.freeCancelUntil ? i18n.t('myRides.refund.freeUntil', { time: formatTime(quote.freeCancelUntil) }) : '';
    return i18n.t('myRides.refund.full', { amount: money(quote.refundAmount), until });
  }
  if (quote.refundAmount <= 0) {
    return i18n.t('myRides.refund.none', { policy });
  }
  const fee = quote.platformFeeKept ? i18n.t('myRides.refund.feeKept', { fee: money(quote.platformFeeKept) }) : '';
  return i18n.t('myRides.refund.partial', { amount: money(quote.refundAmount), fare: money(quote.fare), fee, policy });
}

export function MyRidesScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<RideTab>('upcoming');
  const [upcoming, setUpcoming] = useState<RideItem[]>([]);
  const [history, setHistory] = useState<RideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Finished trips still open for a rating (UC-R06), by booking id
  const [toRate, setToRate] = useState<Map<string, PendingRating>>(new Map());

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      setLoading(true);
      const [res, pending] = await Promise.all([
        bookingService.getRiderBookings(1, 50),
        ratingService.getPending().catch(() => [] as PendingRating[]),
      ]);
      if (!isActive()) return;
      setToRate(new Map(pending.filter(p => p.role === 'rider').map(p => [p.bookingId, p])));
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
  // undefined while loading, null if it could not be fetched
  const [quote, setQuote] = useState<CancellationQuote | null | undefined>(undefined);

  useEffect(() => {
    if (!cancelTarget) return;
    let active = true;
    setQuote(undefined);
    bookingService
      .getCancellationQuote(cancelTarget.id)
      .then(q => { if (active) setQuote(q); })
      .catch(error => {
        logger.warn('Could not load cancellation quote', { error });
        if (active) setQuote(null);
      });
    return () => { active = false; };
  }, [cancelTarget]);

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
      setHistory(prev => [{ ...cancelTarget, status: 'cancelled', reason: t('myRides.reason.byYou') }, ...prev]);
      setCancelDone(true);
    } catch (error) {
      logger.error('Failed to cancel booking', { error });
      Alert.alert(t('myRides.notCancelled'), t('myRides.yourBookingCouldNotBe'));
    } finally {
      setCancelling(false);
    }
  };

  const confirmDisabled = cancelling || quote === undefined;

  const rebook = (r: RideItem) =>
    navigation.navigate('Search', { drop: { name: placeName(r.to), subtitle: r.to.split(',').slice(1).join(',').trim() } });

  /* ── Rows ───────────────────────────────────────────────────── */
  const renderUpcoming = ({ item: r }: { item: RideItem }) => {
    const confirmed = r.status === 'confirmed';
    return (
      <View style={[styles.card, tc.backgroundColor_surface, tc.borderColor_border, Shadow.sm]}>
        <View style={styles.cardTop}>
          <View style={[styles.status, confirmed ? tc.backgroundColor_successLight : tc.backgroundColor_warningLight]}>
            <Icon name={confirmed ? 'check-circle' : 'clock-outline'} size={14} color={confirmed ? tk.successDark : tk.text} />
            <Text style={[styles.statusText, confirmed ? tc.color_successDark : tc.color_text]}>
              {confirmed ? t('myRides.seatConfirmed') : t('myRides.waitingForDriver')}
            </Text>
          </View>
          <Text style={[styles.price, tc.color_text]}>{money(r.price)}</Text>
        </View>
        <Text style={[styles.cardTitle, tc.color_text]} numberOfLines={1}>{placeName(r.to)}</Text>
        <Text style={[styles.meta, tc.color_textSec]} numberOfLines={1}>{t('myRides.from', { place: r.from })}</Text>
        <Text style={[styles.meta, tc.color_textSec]}>{formatDate(r.departure)} · {r.driver}</Text>
        <View style={styles.actions}>
          {confirmed && r.rideId !== '' && (
            <Pressable
              onPress={() => navigation.navigate('ActiveRide', { rideId: r.rideId, bookingId: r.id })}
              accessibilityRole="button"
              style={[styles.actionBtn, tc.backgroundColor_primary]}
            >
              <Icon name="map-marker-radius-outline" size={18} color={tk.textOnPrimary} />
              <Text style={[styles.actionText, tc.color_textOnPrimary]}>{t('myRides.trackRide')}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => { setCancelDone(false); setCancelTarget(r); }}
            accessibilityRole="button"
            accessibilityLabel={t('myRides.cancelLabel', { place: placeName(r.to) })}
            style={[styles.actionBtn, styles.actionOutline, tc.borderColor_border]}
          >
            <Text style={[styles.actionText, tc.color_error]}>{t('myRides.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // Receipts and disputes exist only for seats that were confirmed at some point
  const hadSeat = (r: RideItem) => r.status === 'completed' || (r.status === 'cancelled' && r.price > 0);

  // Trip options in a sheet that follows the app's theme, not Android's grey dialog
  const [historyTarget, setHistoryTarget] = useState<RideItem | null>(null);
  const openHistory = (r: RideItem) => setHistoryTarget(r);
  const historyOptions = (r: RideItem): SheetOption[] => {
    const options: SheetOption[] = [];
    const pending = toRate.get(r.id);
    if (pending) {
      options.push({
        label: t('myRides.rateThisTrip'),
        icon: 'star-outline',
        onPress: () => navigation.navigate('RateTrip', { bookingId: r.id, rateeName: pending.rateeName, summary: `${placeName(r.from)} to ${placeName(r.to)}, ${formatDate(r.departure)}` }),
      });
    }
    if (hadSeat(r)) {
      options.push({ label: t('myRides.receipt'), icon: 'receipt-text-outline', onPress: () => navigation.navigate('Receipt', { bookingId: r.id }) });
      options.push({ label: t('myRides.reportAProblem'), icon: 'alert-circle-outline', onPress: () => navigation.navigate('RaiseDispute', { bookingId: r.id, summary: `${placeName(r.from)} to ${placeName(r.to)}, ${formatDate(r.departure)}` }) });
    }
    options.push({ label: t('myRides.bookAgain'), icon: 'repeat', onPress: () => rebook(r) });
    return options;
  };

  const priceLine = (r: RideItem) => {
    if (r.status === 'completed') return t('myRides.price.completed', { price: money(r.price) });
    if (r.refunded > 0 && r.refunded < r.price) return t('myRides.price.partRefund', { refunded: money(r.refunded), price: money(r.price), reason: r.reason });
    if (r.refunded > 0) return t('myRides.price.fullRefund', { reason: r.reason });
    return r.reason;
  };

  const renderHistory = ({ item: r, index }: { item: RideItem; index: number }) => {
    const completed = r.status === 'completed';
    return (
      <Pressable
        onPress={() => openHistory(r)}
        accessibilityRole="button"
        accessibilityLabel={t('myRides.historyLabel', { place: placeName(r.to), when: formatDate(r.departure), price: priceLine(r), rate: toRate.has(r.id) ? t('myRides.notRatedYet') : '' })}
        style={({ pressed }) => [
          styles.historyRow,
          index < history.length - 1 && [{ borderBottomWidth: StyleSheet.hairlineWidth }, tc.borderBottomColor_border],
          pressed && tc.backgroundColor_surfaceVariant,
        ]}
      >
        <View style={[styles.historyIcon, tc.backgroundColor_surfaceVariant]}>
          <Icon name={completed ? 'map-marker-check-outline' : 'map-marker-remove-outline'} size={22} color={completed ? tk.primary : tk.textSec} />
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.historyTitle, tc.color_text]} numberOfLines={1}>{placeName(r.to)}</Text>
          <Text style={[styles.meta, tc.color_textSec]}>{formatDate(r.departure)}</Text>
          <Text style={[styles.meta, completed ? tc.color_textSec : tc.color_error]}>
            {priceLine(r)}
          </Text>
        </View>
        {toRate.has(r.id) ? (
          <View style={[styles.rateChip, tc.backgroundColor_primaryLight]}>
            <Text style={[{ fontSize: 12, fontWeight: '700' }, tc.color_primary]}>{t('myRides.rate')}</Text>
          </View>
        ) : null}
        <Icon name="chevron-right" size={22} color={tk.textSec} />
      </Pressable>
    );
  };

  const emptyText =
    tab === 'upcoming'
      ? { title: t('myRides.empty.upcomingTitle'), sub: t('myRides.empty.upcomingSub') }
      : { title: t('myRides.empty.historyTitle'), sub: t('myRides.empty.historySub') };

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenGlow />
      <Text style={[styles.title, tc.color_text]} accessibilityRole="header">{t('myRides.myRides')}</Text>

      <View style={[styles.segment, tc.backgroundColor_surfaceVariant]} accessibilityRole="tablist">
        {([
          { id: 'upcoming' as const, label: t('myRides.tabs.upcoming'), count: upcoming.length },
          { id: 'history' as const, label: t('myRides.tabs.history'), count: history.length },
        ]).map(tabItem => {
          const on = tab === tabItem.id;
          return (
            <Pressable
              key={tabItem.id}
              onPress={() => setTab(tabItem.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.segmentItem, on && [tc.backgroundColor_surface, Shadow.sm]]}
            >
              <Text style={[styles.segmentText, on ? tc.color_text : tc.color_textSec]}>
                {tabItem.label}{tabItem.count > 0 ? ` ${tabItem.count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && upcoming.length + history.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={tk.primary} size="large" accessibilityLabel={t('myRides.loadingYourRides')} />
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
              {loadError ? <Icon name="wifi-off" size={48} color={tk.textSec} /> : <EmptyArt icon={tab === 'upcoming' ? 'spiralCalendar' : 'automobile'} />}
              <Text style={[styles.emptyTitle, tc.color_text]}>
                {loadError ? t('myRides.loadFailed') : emptyText.title}
              </Text>
              <Text style={[styles.emptySub, tc.color_textSec]}>
                {loadError ? t('myRides.pullToRetry') : emptyText.sub}
              </Text>
              {!loadError && tab === 'upcoming' && (
                <Pressable
                  onPress={() => navigation.navigate('Search')}
                  accessibilityRole="button"
                  style={[styles.emptyBtn, tc.backgroundColor_primary]}
                >
                  <Text style={[styles.emptyBtnText, tc.color_textOnPrimary]}>{t('myRides.findARide')}</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* ── Cancel sheet ────────────────────────────────────────── */}
      <Modal visible={Boolean(cancelTarget)} transparent animationType="slide" onRequestClose={closeCancel}>
        <Pressable style={styles.scrim} onPress={closeCancel} accessibilityRole="button" accessibilityLabel={t('myRides.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }, tc.backgroundColor_surface]}>
          <View style={[styles.handle, tc.backgroundColor_border]} />
          {cancelDone ? (
            <View style={styles.done} accessibilityLiveRegion="polite">
              <View style={[styles.doneIcon, tc.backgroundColor_successLight]}>
                <Icon name="check" size={36} color={tk.successDark} />
              </View>
              <Text style={[styles.sheetTitle, tc.color_text]}>{t('myRides.rideCancelled')}</Text>
              <Text style={[styles.sheetText, tc.color_textSec]}>
                {quote && quote.refundAmount === 0 ? t('myRides.noRefundWasDueFor') : t('myRides.yourRefundHasBeenStarted')}
              </Text>
              <Pressable onPress={closeCancel} accessibilityRole="button" style={[styles.sheetBtn, styles.doneBtn, tc.backgroundColor_primary]}>
                <Text style={[styles.sheetBtnText, tc.color_textOnPrimary]}>{t('myRides.done')}</Text>
              </Pressable>
            </View>
          ) : cancelTarget ? (
            <>
              <Text style={[styles.sheetTitle, tc.color_text]}>{t('myRides.cancelThisRide')}</Text>
              <View style={[styles.summary, tc.backgroundColor_surfaceVariant]}>
                <Text style={[styles.historyTitle, tc.color_text]} numberOfLines={1}>{placeName(cancelTarget.to)}</Text>
                <Text style={[styles.meta, tc.color_textSec]}>
                  {formatDate(cancelTarget.departure)} · {cancelTarget.driver} · {money(cancelTarget.price)}
                </Text>
              </View>
              <View style={[styles.refund, tc.backgroundColor_infoLight]}>
                <Icon name="cash-refund" size={20} color={tk.info} />
                {quote === undefined ? (
                  <ActivityIndicator color={tk.info} accessibilityLabel={t('myRides.checkingYourRefund')} />
                ) : (
                  <Text style={[styles.sheetText, styles.flex1, { textAlign: 'left' }, tc.color_text]}>
                    {refundMessage(quote)}
                  </Text>
                )}
              </View>
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={closeCancel}
                  disabled={cancelling}
                  accessibilityRole="button"
                  style={[styles.sheetBtn, styles.flex1, styles.actionOutline, tc.borderColor_border]}
                >
                  <Text style={[styles.sheetBtnText, tc.color_text]}>{t('myRides.keepRide')}</Text>
                </Pressable>
                <Pressable
                  onPress={confirmCancel}
                  disabled={confirmDisabled}
                  accessibilityRole="button"
                  accessibilityState={{ busy: cancelling }}
                  style={[styles.sheetBtn, styles.flex1, { backgroundColor: DESTRUCTIVE }]}
                >
                  {cancelling ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.sheetBtnText, { color: '#FFFFFF' }]}>{t('myRides.yesCancel')}</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
      <OptionsSheet
        visible={historyTarget !== null}
        title={historyTarget ? placeName(historyTarget.to) : ''}
        subtitle={historyTarget ? formatDate(historyTarget.departure) : undefined}
        options={historyTarget ? historyOptions(historyTarget) : []}
        closeLabel={t('myRides.close')}
        onClose={() => setHistoryTarget(null)}
      />
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
  rateChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
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
