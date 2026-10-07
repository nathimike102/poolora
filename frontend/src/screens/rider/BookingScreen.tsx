/**
 * screens/rider/BookingScreen.tsx
 *
 * Confirms a seat request on a ride. Everything shown comes from the ride
 * record; the fare shown is what the backend charges (price per seat x seats).
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { ActivityIndicator, Switch } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Spacing, Radius } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { bookingService } from '../../services/bookingService';
import { rideService } from '../../services/rideService';
import { walletService } from '../../services/walletService';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PlaceField } from '../../components/PlaceField';
import { OptionsSheet } from '../../components/OptionsSheet';
import { geocodePlace } from '../../services/placesService';
import { Icon } from '../../components/Icon';
import type { BookingQuote, Ride } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';
import { money, REGION } from '../../utils/region';
import { riderPays } from '../../utils/fares';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Booking'>;
type BookingRoute = RouteProp<RootStackParamList, 'Booking'>;
type PayMethod = 'online' | 'wallet';

const MAX_SEATS_PER_BOOKING = 4;
/** Stops a rider can add here; the server's setting (maxStopsPerBooking) has the last word */
const MAX_OWN_STOPS = 2;

type Place = { lat: number; lng: number; address: string };

function formatDeparture(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function BookingScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<BookingRoute>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const rideId = route.params.rideId;

  const [ride, setRide] = useState<Ride | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [seats, setSeats] = useState(route.params.seats ?? 1);
  const [method, setMethod] = useState<PayMethod>('online');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [walletBooked, setWalletBooked] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  // One of the driver's stops chosen as where to get on or off
  const [boardChoice, setBoardChoice] = useState<Place | null>(null);
  const [leaveChoice, setLeaveChoice] = useState<Place | null>(null);
  const [driverStop, setDriverStop] = useState<Place | null>(null);
  // Stops the rider adds between their pickup and drop (as on Rapido and Uber)
  const [stops, setStops] = useState<Place[]>([]);
  const [stopDraft, setStopDraft] = useState<string | null>(null);
  const [findingStop, setFindingStop] = useState(false);
  const [stopError, setStopError] = useState('');

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

  // Seats may have gone since the rider chose them on the results screen
  useEffect(() => {
    if (ride && seats > maxSeats && maxSeats > 0) setSeats(maxSeats);
  }, [ride, seats, maxSeats]);
  const seatsTotal = (ride?.pricePerSeat ?? 0) * seats;

  // Where the rider searched from and to (anywhere along the route), or else
  // the ride's own start and end
  const riderPickup = route.params.pickup;
  const riderDropoff = route.params.dropoff;
  const boardAt = useMemo(
    () => boardChoice ?? riderPickup ?? {
      lat: ride?.pickupLocation.lat ?? 0,
      lng: ride?.pickupLocation.lng ?? 0,
      address: ride?.pickupLocation.address ?? '',
    },
    [boardChoice, riderPickup, ride],
  );
  const leaveAt = useMemo(
    () => leaveChoice ?? riderDropoff ?? {
      lat: ride?.dropoffLocation.lat ?? 0,
      lng: ride?.dropoffLocation.lng ?? 0,
      address: ride?.dropoffLocation.address ?? '',
    },
    [leaveChoice, riderDropoff, ride],
  );
  // What the rider's company pays of this fare (UC-C01); the rider is charged the rest
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  // Asked again when the server says the price changed
  const [quoteAgain, setQuoteAgain] = useState(0);
  useEffect(() => {
    if (!ride) return;
    let active = true;
    setStopError('');
    bookingService
      .quote({ rideId, seatsBooked: seats, pickup: boardAt, dropoff: leaveAt, stops: stops.length ? stops : undefined })
      .then(q => { if (active) setQuote(q); })
      .catch(error => {
        if (!active) return;
        setQuote(null);
        // A stop off the route or in the wrong place: say so where the stops are
        if (stops.length) setStopError(errorHandler.process(error).message);
      });
    return () => { active = false; };
  }, [ride, rideId, seats, boardAt, leaveAt, stops, quoteAgain]);
  // Stops are priced by the server; until it has, the request waits
  const stopsPriced = stops.length === 0 || quote?.stopCount === stops.length;
  const stopsFee = stops.length && stopsPriced ? quote?.stopsFee ?? 0 : 0;
  const total = Math.round((seatsTotal + stopsFee) * 100) / 100;
  // Only a quote for the fare on screen counts
  const companyPart = quote && Math.abs(quote.fare - total) < 0.005 ? quote.companyShare : 0;
  const youPay = Math.round((total - companyPart) * 100) / 100;
  const walletCovers = walletBalance !== null && walletBalance >= youPay;

  // Catching a bus from a terminus at the drop (UC-R12): when it leaves, in 15-minute steps
  const atTerminus = quote?.dropoffHub?.kind === 'bus_terminus' ? quote.dropoffHub.name : null;
  const [busAt, setBusAt] = useState<Date | null>(null);
  const rideLeaves = ride ? new Date(ride.scheduledDeparture).getTime() : 0;
  const firstBus = () => {
    const arrives = ride?.estimatedArrival ? new Date(ride.estimatedArrival).getTime() : rideLeaves + 3_600_000;
    const step = 15 * 60_000;
    return new Date(Math.ceil((arrives + 30 * 60_000) / step) * step);
  };
  const moveBus = (mins: number) => setBusAt(b => {
    if (!b) return b;
    const next = new Date(b.getTime() + mins * 60_000);
    return next.getTime() > rideLeaves && next.getTime() - rideLeaves <= 24 * 3_600_000 ? next : b;
  });

  const handleConfirm = useCallback(async () => {
    if (!ride || isSubmitting) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const result = await bookingService.createBooking({
        rideId,
        seatsBooked: seats,
        pickup: boardAt,
        dropoff: leaveAt,
        useWallet: method === 'wallet',
        expectedYouPay: youPay,
        note: note.trim() || undefined,
        connection: atTerminus && busAt ? { departsAt: busAt.toISOString() } : undefined,
        stops: stops.length ? stops : undefined,
      });

      // The booking says what the rider is charged: the quote may have come
      // late, or the company's part changed (cap used up, paused) since
      const charged = riderPays(result.booking);
      if (result.paidViaWallet) {
        setPaidAmount(charged);
        setWalletBooked(true);
        return;
      }
      navigation.replace('Payment', {
        bookingId: result.booking._id,
        amount: charged,
        summary: t('booking.summary', { from: boardAt.address || t('booking.pickup'), to: leaveAt.address || t('booking.dropLower'), seats: seats === 1 ? t('search.seatOne') : t('search.seatMany', { count: seats }) }),
      });
    } catch (error) {
      const problem = errorHandler.process(error);
      // The company's part shrank since the quote: show the new price before they book again
      if (problem.errorId === 'PRICE_CHANGED') setQuoteAgain(n => n + 1);
      setSubmitError(problem.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [ride, isSubmitting, rideId, seats, method, youPay, note, navigation, boardAt, leaveAt, atTerminus, busAt, stops, t]);

  const addStop = useCallback(async () => {
    const text = stopDraft?.trim();
    if (!text || findingStop) return;
    setFindingStop(true);
    setStopError('');
    try {
      const p = await geocodePlace(text);
      setStops(list => [...list, { lat: p.lat, lng: p.lng, address: p.formattedAddress || text }]);
      setStopDraft(null);
    } catch (error) {
      setStopError(errorHandler.process(error).message);
    } finally {
      setFindingStop(false);
    }
  }, [stopDraft, findingStop]);

  // ── Booked with wallet ──────────────────────────────────────────
  if (walletBooked) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
        <View style={[styles.confirmedCircle, tc.backgroundColor_success]}>
          <Icon name="check" size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.confirmedTitle, tc.color_text]} accessibilityLiveRegion="polite">
          {t('booking.sent')}
        </Text>
        <Text style={[styles.confirmedSub, tc.color_textSec]}>
          {t('booking.paidFromWallet', { amount: money(paidAmount ?? youPay) })}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('RiderTabs', { screen: 'MyRides' })}
          accessibilityRole="button"
          style={[styles.primaryBtn, tc.backgroundColor_primary]}
        >
          <Text style={[styles.primaryBtnText, tc.color_textOnPrimary]}>{t('booking.viewRides')}</Text>
        </Pressable>
      </View>
    );
  }

  // ── Load states ─────────────────────────────────────────────────
  if (loadError || !ride) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
        {loadError ? (
          <>
            <Text style={[styles.confirmedTitle, tc.color_text]}>{t('booking.loadFailed')}</Text>
            <Pressable onPress={load} accessibilityRole="button" style={[styles.primaryBtn, tc.backgroundColor_primary]}>
              <Text style={[styles.primaryBtnText, tc.color_textOnPrimary]}>{t('booking.tryAgain')}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={tk.primary} accessibilityLabel={t('booking.loading')} />
        )}
      </View>
    );
  }

  const stats = ride.driver?.stats;
  const ratingCount = stats?.totalRatingsAsDriver ?? 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <ScreenHeader title={t('booking.title')} />

      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Ride summary */}
        <View style={[
          styles.card,
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}>
          <View style={styles.driverRow}>
            {ride.driver?.profilePhotoUrl ? (
              <Image source={{ uri: ride.driver.profilePhotoUrl }} style={styles.driverAvatar} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[styles.driverAvatar, styles.avatarFallback, tc.backgroundColor_primaryLight]}>
                <Text style={[{ fontSize: 18, fontWeight: '700' }, tc.color_primary]}>
                  {(ride.driver?.name ?? 'D').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.flex1}>
              <Text style={[styles.driverName, tc.color_text]}>{ride.driver?.name ?? t('booking.driver')}</Text>
              {ride.vehicle?.plateNumber ? (
                <Text style={[styles.driverMeta, tc.color_textSec]}>{ride.vehicle.plateNumber}</Text>
              ) : null}
            </View>
            <Text style={[styles.driverMeta, tc.color_textSec]}>
              {ratingCount > 0 ? `${stats?.avgRatingAsDriver?.toFixed(1)} (${ratingCount})` : t('booking.noRatings')}
            </Text>
          </View>

          <View style={[styles.divider, tc.backgroundColor_border]} />

          <Text style={[styles.routeLabel, tc.color_textSec]}>{t('booking.pickup')}</Text>
          <Text style={[styles.routePlace, tc.color_text]}>{boardAt.address}</Text>
          <Text style={[styles.routeTime, tc.color_primary]}>{formatDeparture(ride.scheduledDeparture)}</Text>
          <Text style={[styles.routeLabel, { marginTop: 12 }, tc.color_textSec]}>{t('booking.drop')}</Text>
          <Text style={[styles.routePlace, tc.color_text]}>{leaveAt.address}</Text>
        </View>

        {/* The driver's own stops: get on or off at one of them */}
        {ride.stops?.length ? (
          <View style={[styles.card, tc.backgroundColor_surfaceVariant, tc.borderColor_surfaceVariant]}>
            <Text style={[styles.cardTitle, tc.color_text]}>{t('booking.driverStops')}</Text>
            <Text style={[styles.stopHint, tc.color_textSec]}>{t('booking.driverStopsHint')}</Text>
            {ride.stops.map((stop, i) => {
              const place = { lat: stop.lat, lng: stop.lng, address: stop.address ?? '' };
              const role = boardChoice?.address === place.address ? t('booking.getOnHere') : leaveChoice?.address === place.address ? t('booking.getOffHere') : null;
              return (
                <Pressable
                  key={`${stop.lat},${stop.lng},${i}`}
                  onPress={() => setDriverStop(place)}
                  accessibilityRole="button"
                  accessibilityLabel={role ? `${place.address}, ${role}` : place.address}
                  style={styles.stopRow}
                >
                  <Icon name="map-marker-outline" size={20} color={role ? tk.primary : tk.textSec} />
                  <Text style={[styles.stopText, tc.color_text]} numberOfLines={2}>{place.address}</Text>
                  {role ? <Text style={[styles.stopTag, tc.color_primary]}>{role}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* The rider's own stops, between their pickup and drop */}
        <View style={[styles.card, tc.backgroundColor_surfaceVariant, tc.borderColor_surfaceVariant]}>
          <Text style={[styles.cardTitle, tc.color_text]}>{t('booking.yourStops')}</Text>
          <Text style={[styles.stopHint, tc.color_textSec]}>{t('booking.yourStopsHint')}</Text>
          {stops.map((stop, i) => (
            <View key={`${stop.lat},${stop.lng},${i}`} style={styles.stopRow}>
              <Icon name="map-marker-plus-outline" size={20} color={tk.primary} />
              <Text style={[styles.stopText, tc.color_text]} numberOfLines={2}>{stop.address}</Text>
              <Pressable
                onPress={() => setStops(list => list.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={t('booking.removeStop', { place: stop.address })}
                hitSlop={8}
              >
                <Icon name="close" size={20} color={tk.textSec} />
              </Pressable>
            </View>
          ))}
          {stopDraft !== null ? (
            <View style={{ marginTop: Spacing.sm }}>
              <PlaceField label={t('booking.stopLabel')} value={stopDraft} onChange={setStopDraft} near={boardAt} />
              <View style={styles.stopActions}>
                <Pressable onPress={() => { setStopDraft(null); setStopError(''); }} accessibilityRole="button" style={[styles.stopBtn, tc.borderColor_border]}>
                  <Text style={[styles.stopBtnText, tc.color_text]}>{t('booking.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={addStop}
                  disabled={!stopDraft.trim() || findingStop}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !stopDraft.trim() || findingStop, busy: findingStop }}
                  style={[styles.stopBtn, tc.backgroundColor_primary, tc.borderColor_primary, (!stopDraft.trim() || findingStop) && { opacity: 0.5 }]}
                >
                  {findingStop
                    ? <ActivityIndicator color={tk.textOnPrimary} size="small" />
                    : <Text style={[styles.stopBtnText, tc.color_textOnPrimary]}>{t('booking.addThisStop')}</Text>}
                </Pressable>
              </View>
            </View>
          ) : stops.length < MAX_OWN_STOPS ? (
            <Pressable onPress={() => setStopDraft('')} accessibilityRole="button" style={styles.stopRow}>
              <Icon name="plus-circle-outline" size={20} color={tk.primary} />
              <Text style={[styles.stopText, tc.color_primary, { fontWeight: '700' }]}>{t('booking.addStop')}</Text>
            </Pressable>
          ) : null}
          {stopError ? <Text style={[styles.stopHint, tc.color_error]} accessibilityLiveRegion="polite">{stopError}</Text> : null}
        </View>

        <View style={[styles.noteBox, tc.backgroundColor_primaryLight]}>
          <Icon name="map-marker-radius" size={18} color={tk.primary} />
          <Text style={[styles.noteText, tc.color_text]}>
            {t('booking.boardNote')}
          </Text>
        </View>

        {/* Seats */}
        <View style={[
          styles.card,
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}>
          <Text style={[styles.cardTitle, tc.color_text]}>{t('booking.seats')}</Text>
          {maxSeats === 0 ? (
            <Text style={tc.color_textSec}>{t('booking.full')}</Text>
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
                    accessibilityLabel={n === 1 ? t('search.seatOne') : t('search.seatMany', { count: n })}
                    style={[
                      styles.seatBtn,
                      selected ? tc.borderColor_primary : tc.borderColor_border,
                      selected ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                    ]}
                  >
                    <Text style={[styles.seatBtnText, selected ? tc.color_primary : tc.color_text]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Message to the driver (UC-R03 step 6) */}
        <View style={[
          styles.card,
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}>
          <Text style={[styles.cardTitle, tc.color_text]}>{t('booking.noteTitle')}</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={300}
            multiline
            placeholder={t('booking.notePlaceholder')}
            placeholderTextColor={tk.textSec}
            accessibilityLabel={t('booking.noteLabel')}
            style={[{ borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 64, fontSize: 15, textAlignVertical: 'top' }, tc.borderColor_border, tc.color_text]}
          />
        </View>

        {/* Payment method */}
        <View style={[
          styles.card,
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}>
          <Text style={[styles.cardTitle, tc.color_text]}>{t('booking.payWith')}</Text>
          {([
            { id: 'online' as const, label: t('booking.online'), sub: t('booking.onlineSub'), icon: 'cellphone' as const, enabled: true },
            {
              id: 'wallet' as const,
              label: t('booking.wallet'),
              sub: walletBalance === null
                ? t('booking.balanceUnavailable')
                : `${t('booking.balance', { amount: money(walletBalance) })}${walletCovers ? '' : t('booking.notEnough')}`,
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
                style={[
                  styles.methodRow,
                  { opacity: m.enabled ? 1 : 0.55 },
                  selected ? tc.borderColor_primary : tc.borderColor_border
                ]}
              >
                <Icon name={m.icon} size={22} color={tk.textSec} />
                <View style={styles.flex1}>
                  <Text style={[{ fontSize: 15, fontWeight: '600' }, tc.color_text]}>{m.label}</Text>
                  <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{m.sub}</Text>
                </View>
                <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={selected ? tk.primary : tk.textSec} />
              </Pressable>
            );
          })}
        </View>

        {atTerminus ? (
          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <View style={styles.fareRow}>
              <Text style={[{ flex: 1, fontSize: 15, fontWeight: '700' }, tc.color_text]}>{t('booking.bus.title', { hub: atTerminus })}</Text>
              <Switch
                value={busAt !== null}
                onValueChange={on => setBusAt(on ? firstBus() : null)}
                accessibilityLabel={t('booking.bus.title', { hub: atTerminus })}
                trackColor={{ false: tk.border, true: tk.primary }}
              />
            </View>
            <Text style={[{ fontSize: 12, marginTop: 4 }, tc.color_textSec]}>{t('booking.bus.help')}</Text>
            {busAt ? (
              <View style={[styles.fareRow, { marginTop: 10 }]}>
                <Pressable onPress={() => moveBus(-15)} accessibilityRole="button" accessibilityLabel={t('booking.bus.earlier')} hitSlop={8}>
                  <Icon name="minus-circle-outline" size={28} color={tk.primary} />
                </Pressable>
                <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_text]} accessibilityLiveRegion="polite">
                  {t('booking.bus.leaves')} {busAt.toLocaleTimeString(REGION.dateLocale, { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Pressable onPress={() => moveBus(15)} accessibilityRole="button" accessibilityLabel={t('booking.bus.later')} hitSlop={8}>
                  <Icon name="plus-circle-outline" size={28} color={tk.primary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Fare */}
        <View style={[
          styles.card,
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}>
          <View style={styles.fareRow}>
            <Text style={[{ fontSize: 14 }, tc.color_textSec]}>
              {t('booking.fareLine', { price: money(ride.pricePerSeat), seats: seats === 1 ? t('search.seatOne') : t('search.seatMany', { count: seats }) })}
            </Text>
            <Text style={[{ fontSize: stops.length ? 14 : 18, fontWeight: stops.length ? '700' : '800' }, tc.color_text]}>{money(stops.length ? seatsTotal : total)}</Text>
          </View>
          {stops.length ? (
            <>
              <View style={styles.fareRow}>
                <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{stops.length === 1 ? t('booking.stopsLineOne') : t('booking.stopsLineMany', { count: stops.length })}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>{stopsPriced ? money(stopsFee) : '…'}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>{t('booking.fareTotal')}</Text>
                <Text style={[{ fontSize: 18, fontWeight: '800' }, tc.color_text]}>{money(total)}</Text>
              </View>
            </>
          ) : null}
          {companyPart > 0 && quote?.company ? (
            <>
              <View style={styles.fareRow}>
                <Text style={[{ fontSize: 14 }, tc.color_success]}>{t('booking.companyPays', { company: quote.company })}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_success]}>−{money(companyPart)}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>{t('booking.youPay')}</Text>
                <Text style={[{ fontSize: 18, fontWeight: '800' }, tc.color_text]}>{money(youPay)}</Text>
              </View>
            </>
          ) : null}
          {quote?.company && quote.limitedBy === 'cap' ? (
            <Text style={[{ fontSize: 12, marginTop: 6 }, tc.color_textSec]}>
              {companyPart > 0 ? t('booking.capNearly', { company: quote.company }) : t('booking.capUsed', { company: quote.company })}
            </Text>
          ) : null}
          <Text style={[{ fontSize: 12, marginTop: 8, lineHeight: 18 }, tc.color_textSec]}>
            {t('booking.refundNote')}
          </Text>
        </View>
      </ScrollView>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <View style={[styles.ctaBar, tc.backgroundColor_surface, tc.borderTopColor_border]}>
        {submitError ? (
          <Text style={[styles.errorText, tc.color_error]} accessibilityLiveRegion="polite">{submitError}</Text>
        ) : null}
        <Pressable
          onPress={handleConfirm}
          disabled={isSubmitting || maxSeats === 0 || !stopsPriced}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting || maxSeats === 0 || !stopsPriced, busy: isSubmitting }}
          style={[
            styles.primaryBtn,
            { marginTop: 0, width: '100%' },
            maxSeats === 0 || !stopsPriced ? tc.backgroundColor_border : tc.backgroundColor_primary
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={tk.textOnPrimary} />
          ) : (
            <Text style={[styles.primaryBtnText, tc.color_textOnPrimary]}>
              {youPay <= 0 && quote?.company ? t('booking.requestCompanyPays', { company: quote.company }) : method === 'wallet' ? t('booking.payWallet', { amount: money(youPay) }) : t('booking.payOnline', { amount: money(youPay) })}
            </Text>
          )}
        </Pressable>
      </View>

      <OptionsSheet
        visible={driverStop !== null}
        title={driverStop?.address ?? ''}
        options={driverStop ? [
          { label: t('booking.getOnHere'), icon: 'arrow-up-circle-outline', onPress: () => { setBoardChoice(driverStop); if (leaveChoice?.address === driverStop.address) setLeaveChoice(null); setDriverStop(null); } },
          { label: t('booking.getOffHere'), icon: 'arrow-down-circle-outline', onPress: () => { setLeaveChoice(driverStop); if (boardChoice?.address === driverStop.address) setBoardChoice(null); setDriverStop(null); } },
          ...(boardChoice?.address === driverStop.address || leaveChoice?.address === driverStop.address
            ? [{ label: t('booking.useMyOwnPoint'), icon: 'undo' as const, onPress: () => { if (boardChoice?.address === driverStop.address) setBoardChoice(null); if (leaveChoice?.address === driverStop.address) setLeaveChoice(null); setDriverStop(null); } }]
            : []),
        ] : []}
        closeLabel={t('booking.cancel')}
        onClose={() => setDriverStop(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  stopHint: { fontSize: 13, lineHeight: 18, marginTop: 2, marginBottom: 6 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  stopText: { flex: 1, fontSize: 15 },
  stopTag: { fontSize: 12, fontWeight: '700' },
  stopActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  stopBtn: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stopBtnText: { fontSize: 14, fontWeight: '700' },
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
    borderTopWidth: 1,
  },
  errorText: { fontSize: Typography.base, marginBottom: Spacing.sm, textAlign: 'center' },
  primaryBtn: {
    minHeight: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
  },
  primaryBtnText: { fontSize: Typography.xl, fontWeight: Typography.bold },
});
