/**
 * screens/rider/ActiveRideScreen.tsx
 *
 * Live view of a booked ride for the rider. Status comes from the ride record
 * (polled), driver position and route-deviation alerts come from the booking's
 * tracking room over Socket.io. Nothing on this screen is simulated.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Linking,
  Share,
  Modal,
  Alert,
} from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { rideService } from '../../services/rideService';
import { bookingService } from '../../services/bookingService';
import { safetyService } from '../../services/safetyService';
import { ratingService, type RatingInput } from '../../services/ratingService';
import { RatingForm } from '../../components/RatingForm';
import type { Ride } from '../../types/api';
import { callOnBooking } from '../../services/callService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveMap } from '../../components/LiveMap';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { Radius, Shadow } from '../../theme';
import { initSocket } from '../../utils/socket';
import { decodePolyline } from '../../utils/polyline';
import { errorHandler } from '../../utils/errorHandler';
import { realPhone } from '../../utils/phone';
import { REGION } from '../../utils/region';
import { emergencyNumbers as currentEmergency } from '../../utils/emergencyNumbers';
import { startTripTracking, stopTripTracking } from '../../services/tripTracking';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const POLL_MS = 15_000;

function formatTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(REGION.dateLocale, { hour: '2-digit', minute: '2-digit' });
}

export function ActiveRideScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { rideId, bookingId } = useRoute<RouteProp<RootStackParamList, 'ActiveRide'>>().params;
  const { t } = useTranslation();

  const [ride, setRide] = useState<Ride | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [driverUpdate, setDriverUpdate] = useState<string>('');
  /** When the driver's position last came in */
  const [lastSeen, setLastSeen] = useState<string>('');
  const [deviationMessage, setDeviationMessage] = useState<string>('');
  // An in-ride "Are you OK?" prompt waiting for an answer (UC-R05)
  const [checkIn, setCheckIn] = useState<{ repeat: boolean } | null>(null);
  const [answering, setAnswering] = useState(false);
  // The rider's pickup code, and whether the pickup has been confirmed
  const [pickup, setPickup] = useState<{ pin?: string; done: boolean } | null>(null);
  const route = useMemo(() => decodePolyline(ride?.routePolyline), [ride?.routePolyline]);


  // Poll the ride so status changes (started, completed, cancelled) show up
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await rideService.getRide(rideId);
        if (active) {
          setRide(data);
          setLoadError(false);
        }
      } catch {
        if (active) setLoadError(true);
      }
    };
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [rideId]);

  // A prompt may be waiting when the rider opens the app from the push; the
  // booking also carries the pickup code and whether the pickup is confirmed
  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    let first = true;
    const load = () => bookingService
      .getRiderBookings(1, 20, 'confirmed')
      .then(page => {
        const mine = (page.data?.items ?? []).find(b => b._id === bookingId) as
          | { safetyCheck?: { promptedAt?: string; answeredAt?: string; missed?: number }; pickupPin?: string; actualPickupTime?: string }
          | undefined;
        if (!active || !mine) return;
        setPickup({ pin: mine.pickupPin, done: Boolean(mine.actualPickupTime) });
        const check = mine.safetyCheck;
        if (first && check?.promptedAt && (!check.answeredAt || check.answeredAt < check.promptedAt)) {
          setCheckIn({ repeat: (check.missed ?? 0) > 0 });
        }
        first = false;
      })
      .catch(() => undefined);
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [bookingId]);

  // From pickup to drop the rider's phone is traced too (background task), so
  // the safety team can find them even if separated from the car
  const tripStatus = ride?.status as string | undefined;
  useEffect(() => {
    if (!pickup?.done || !rideId) return;
    if (tripStatus === 'in_progress') startTripTracking(rideId, 'rider');
    else if (tripStatus === 'completed' || tripStatus === 'cancelled') stopTripTracking(rideId);
  }, [pickup?.done, tripStatus, rideId]);

  const confirmInCar = () => {
    if (!bookingId) return;
    const car = ride?.vehicle?.plateNumber ? ` ${ride.vehicle.plateNumber}` : '';
    Alert.alert(
      t('ride.inCarTitle'),
      t('ride.inCarBody', { car, driver: ride?.driver?.name ?? t('ride.yourDriverLower') }),
      [
        { text: t('ride.notYet'), style: 'cancel' },
        {
          text: t('ride.imInCar'),
          onPress: async () => {
            try {
              await bookingService.riderInCar(bookingId);
              setPickup(p => ({ ...p, done: true }));
            } catch (error) {
              Alert.alert(t('ride.notConfirmed'), errorHandler.process(error).message);
            }
          },
        },
      ],
    );
  };

  const answerCheckIn = async (status: 'ok' | 'help') => {
    if (!bookingId) return;
    setAnswering(true);
    try {
      await safetyService.answerRideCheckIn(bookingId, status);
      setCheckIn(null);
      // The SOS screen shows the alert, the cancel window and the safety team's reply
      if (status === 'help') navigation.navigate('SOS', { bookingId });
    } catch (error) {
      Alert.alert(t('common.notSent'), t('ride.checkInNotSent', { message: errorHandler.process(error).message, number: currentEmergency().general }));
    } finally {
      setAnswering(false);
    }
  };

  // Live driver position and deviation alerts for this booking
  useEffect(() => {
    if (!bookingId) return;
    const socket = initSocket();
    const join = () => socket.emit('tracking:join', bookingId);
    const onLocation = (data: { bookingId: string; location: { lat: number; lng: number }; timestamp: number }) => {
      if (data.bookingId !== bookingId) return;
      setDriverLocation({ latitude: data.location.lat, longitude: data.location.lng });
      setLastSeen(new Date(data.timestamp).toLocaleTimeString(REGION.dateLocale, { hour: '2-digit', minute: '2-digit' }));
    };
    // The server sends a catalogue key with its English, so the alert reads in the rider's language
    type ServerAlert = { bookingId: string; message: string; messageKey?: string; messageVars?: Record<string, number> };
    const words = (data: ServerAlert) => (data.messageKey ? t(data.messageKey, { ...data.messageVars, defaultValue: data.message }) : data.message);
    const onMilestone = (data: ServerAlert) => {
      if (data.bookingId === bookingId) setDriverUpdate(words(data));
    };
    const onDeviation = (data: ServerAlert) => {
      if (data.bookingId === bookingId) setDeviationMessage(words(data));
    };
    const onCheckIn = (data: { bookingId: string; repeat: boolean }) => {
      if (data.bookingId === bookingId) setCheckIn({ repeat: data.repeat });
    };

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('driver:location:updated', onLocation);
    socket.on('driver:milestone', onMilestone);
    socket.on('route:deviated', onDeviation);
    socket.on('safety:check-in', onCheckIn);
    return () => {
      socket.off('safety:check-in', onCheckIn);
      socket.emit('tracking:leave', bookingId);
      socket.off('connect', join);
      socket.off('driver:location:updated', onLocation);
      socket.off('driver:milestone', onMilestone);
      socket.off('route:deviated', onDeviation);
    };
  }, [bookingId, t]);

  const submitRating = useCallback(async (input: RatingInput) => {
    if (!bookingId) return;
    await ratingService.submitRating(bookingId, input);
    navigation.navigate('RiderTabs', { screen: 'MyRides' });
  }, [bookingId, navigation]);

  const shareTrip = async () => {
    if (!ride) return;
    // A live link people can open without the app (UC-R08); plain text if that fails
    if (bookingId) {
      try {
        const { url } = await bookingService.shareTrip(bookingId);
        await Share.share({
          message: t('ride.shareLive', { from: ride.pickupLocation.address, to: ride.dropoffLocation.address, url }),
        });
        return;
      } catch {
        // fall through to the text-only message
      }
    }
    const plate = ride.vehicle?.plateNumber ? ` (${ride.vehicle.plateNumber})` : '';
    Share.share({
      message: t('ride.shareText', {
        driver: ride.driver?.name ?? t('ride.myDriver'),
        plate,
        from: ride.pickupLocation.address,
        to: ride.dropoffLocation.address,
        time: formatTime(ride.scheduledDeparture),
      }),
    });
  };

  // "Driver is 1 km away" and "Driver has arrived" stop applying once the trip starts
  const rideStatus = ride?.status;
  useEffect(() => {
    if (rideStatus === 'in_progress') setDriverUpdate('');
  }, [rideStatus]);

  if (!ride) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
        {loadError ? (
          <>
            <Text style={[{ fontSize: 17, fontWeight: '700' }, tc.color_text]}>{t('ride.loadFailed')}</Text>
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={styles.textBtn}>
              <Text style={[{ fontSize: 15, fontWeight: '600' }, tc.color_primary]}>{t('ride.goBack')}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={tk.primary} accessibilityLabel={t('ride.loading')} />
        )}
      </View>
    );
  }

  const status = ride.status as string;
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const inProgress = status === 'in_progress';
  const statusLabel = isCompleted
    ? t('ride.status.completed')
    : isCancelled
      ? t('ride.status.cancelled')
      : inProgress
        ? t('ride.status.inProgress')
        : t('ride.status.departs', { time: formatTime(ride.scheduledDeparture) });
  const driverName = ride.driver?.name ?? t('ride.yourDriver');
  const driverPhone = realPhone(ride.driver?.phone);

  const origin = { latitude: ride.pickupLocation.lat, longitude: ride.pickupLocation.lng };
  const destination = { latitude: ride.dropoffLocation.lat, longitude: ride.dropoffLocation.lng };

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      {/* Map header */}
      <View style={styles.mapWrap}>
        <LiveMap
          showRoute
          showDriver={Boolean(driverLocation)}
          origin={origin}
          destination={destination}
          route={route}
          driverLocation={driverLocation}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.mapOverlay}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('ride.goBack')}
            style={styles.backBtn}
          >
            <Icon name="arrow-left" size={20} color="#1A1A2E" />
          </Pressable>
          <View style={styles.statusChip} accessibilityLiveRegion="polite">
            <Text style={[{ fontSize: 13, fontWeight: '700' }, tc.color_primary]}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isCompleted ? (
          /* ── Rating ─────────────────────────────────────────────── */
          <View style={styles.ratingWrap}>
            {bookingId ? (
              <Pressable
                onPress={() => navigation.navigate('Receipt', { bookingId })}
                accessibilityRole="button"
                style={[
                  styles.shareBtn,
                  tc.backgroundColor_surfaceVariant,
                  tc.borderColor_surfaceVariant
                ]}
              >
                <Icon name="receipt-text-outline" size={18} color={tk.textSec} />
                <Text style={[{ fontSize: 14, marginLeft: 8 }, tc.color_text]}>{t('ride.viewReceipt')}</Text>
              </Pressable>
            ) : null}
            {bookingId ? (
              <RatingForm
                rateeName={driverName}
                onSubmit={submitRating}
                onSkip={() => navigation.navigate('RiderTabs', { screen: 'MyRides' })}
              />
            ) : null}
          </View>
        ) : (
          <>
            {deviationMessage ? (
              <View style={styles.deviationCard} accessibilityLiveRegion="assertive">
                <Icon name="alert" size={20} color="#9A3412" />
                <View style={styles.flex1}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#9A3412' }}>{deviationMessage}</Text>
                  <Text style={{ fontSize: 13, color: '#9A3412', marginTop: 2 }}>
                    {t('ride.deviationHelp')}
                  </Text>
                </View>
                <Pressable onPress={() => setDeviationMessage('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('ride.dismissAlert')}>
                  <Icon name="close" size={18} color="#9A3412" />
                </Pressable>
              </View>
            ) : null}

            {/* Pickup code: the rider gets in only once the driver has entered it */}
            {pickup?.pin && !pickup.done && !isCompleted && !isCancelled ? (
              <View style={[styles.section, tc.backgroundColor_primaryLight, tc.borderColor_primary]} accessibilityLabel={t('ride.pinLabel', { digits: pickup.pin.split('').join(' ') })}>
                <Text style={[{ fontSize: 13, fontWeight: '700' }, tc.color_primary]}>{t('ride.pinTitle')}</Text>
                <Text style={[{ fontSize: 34, fontWeight: '800', letterSpacing: 10 }, tc.color_text]} selectable>{pickup.pin}</Text>
                <Text style={[{ fontSize: 13, lineHeight: 19 }, tc.color_text]}>
                  {t('ride.pinHelp', { plate: ride.vehicle?.plateNumber ? ` (${ride.vehicle.plateNumber})` : '' })}
                </Text>
                <Pressable onPress={confirmInCar} hitSlop={6} accessibilityRole="button" style={{ marginTop: 8 }}>
                  <Text style={[{ fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }, tc.color_primary]}>{t('ride.pinCantShare')}</Text>
                </Pressable>
              </View>
            ) : pickup?.done && !isCompleted && !isCancelled ? (
              <View style={[styles.section, tc.backgroundColor_successLight, tc.borderColor_success]} accessibilityLiveRegion="polite">
                <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>{t('ride.pickupConfirmed')}</Text>
              </View>
            ) : null}

            {/* Trip */}
            <View style={[
              styles.section,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}>
              <Text style={[{ fontSize: 12, fontWeight: '600' }, tc.color_textSec]}>{t('ride.pickup')}</Text>
              <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]}>{ride.pickupLocation.address}</Text>
              <Text style={[{ fontSize: 13 }, tc.color_primary]}>{formatTime(ride.scheduledDeparture)}</Text>
              <Text style={[{ fontSize: 12, fontWeight: '600', marginTop: 12 }, tc.color_textSec]}>{t('ride.drop')}</Text>
              <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]}>{ride.dropoffLocation.address}</Text>
              {ride.estimatedArrival ? (
                <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{t('ride.eta', { time: formatTime(ride.estimatedArrival) })}</Text>
              ) : null}
              {driverUpdate ? (
                <Text style={[{ fontSize: 13, marginTop: 12 }, tc.color_text]} accessibilityLiveRegion="polite">
                  {driverUpdate}
                </Text>
              ) : null}
              {lastSeen ? (
                <Text style={[{ fontSize: 12, marginTop: driverUpdate ? 2 : 12 }, tc.color_textSec]}>{t('ride.driverSeen', { time: lastSeen })}</Text>
              ) : null}
            </View>

            {/* Driver card */}
            <View style={[
              styles.card,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}>
              {ride.driver?.profilePhotoUrl ? (
                <Image source={{ uri: ride.driver.profilePhotoUrl }} style={styles.driverAvatar} />
              ) : (
                <View style={[styles.driverAvatar, styles.centeredInline, tc.backgroundColor_primaryLight]}>
                  <Text style={[{ fontSize: 18, fontWeight: '700' }, tc.color_primary]}>{driverName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.flex1}>
                <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]}>{driverName}</Text>
                {ride.vehicle?.plateNumber ? (
                  <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{ride.vehicle.plateNumber}</Text>
                ) : null}
              </View>
              <View style={styles.actionBtns}>
                {driverPhone || bookingId ? (
                  <Pressable
                    style={[styles.iconBtn, tc.backgroundColor_successLight]}
                    onPress={() => (bookingId ? callOnBooking(bookingId, driverName, driverPhone) : Linking.openURL(`tel:${driverPhone}`))}
                    accessibilityRole="button"
                    accessibilityLabel={t('ride.call', { name: driverName })}
                  >
                    <Icon name="phone" size={20} color={tk.success} />
                  </Pressable>
                ) : null}
                {bookingId ? (
                  <Pressable
                    style={[styles.iconBtn, tc.backgroundColor_primaryLight]}
                    onPress={() => navigation.navigate('Chat', { chatId: bookingId, recipientName: driverName })}
                    accessibilityRole="button"
                    accessibilityLabel={t('ride.message', { name: driverName })}
                  >
                    <Icon name="message-text" size={20} color={tk.primary} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {!isCancelled && (
              <Pressable
                onPress={shareTrip}
                accessibilityRole="button"
                style={[
                  styles.shareBtn,
                  tc.backgroundColor_surfaceVariant,
                  tc.borderColor_surfaceVariant
                ]}
              >
                <Icon name="share-variant" size={18} color={tk.textSec} />
                <Text style={[{ fontSize: 14, marginLeft: 8 }, tc.color_text]}>{t('ride.shareLink')}</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={Boolean(checkIn)} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.checkInScrim}>
          <View style={[styles.checkInCard, tc.backgroundColor_surface]} accessibilityViewIsModal>
            <Icon name="shield-check" size={36} color={tk.primary} />
            <Text style={[{ fontSize: 20, fontWeight: '800', textAlign: 'center' }, tc.color_text]} accessibilityRole="header">
              {checkIn?.repeat ? t('ride.checkIn.titleRepeat') : t('ride.checkIn.title')}
            </Text>
            <Text style={[{ fontSize: 14, textAlign: 'center' }, tc.color_textSec]}>
              {checkIn?.repeat
                ? t('ride.checkIn.bodyRepeat')
                : t('ride.checkIn.body')}
            </Text>
            <Pressable
              onPress={() => answerCheckIn('ok')}
              disabled={answering}
              accessibilityRole="button"
              style={[styles.checkInBtn, tc.backgroundColor_primary]}
            >
              <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_textOnPrimary]}>{t('ride.checkIn.ok')}</Text>
            </Pressable>
            <Pressable
              onPress={() => answerCheckIn('help')}
              disabled={answering}
              accessibilityRole="button"
              style={[styles.checkInBtn, tc.backgroundColor_errorLight]}
            >
              <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_error]}>{t('ride.checkIn.help')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {!isCompleted && !isCancelled && (
        <Pressable
          onPress={() => navigation.navigate('SOS', { bookingId })}
          accessibilityRole="button"
          accessibilityLabel={t('ride.sosLabel')}
          style={[styles.sosFab, tc.backgroundColor_error]}
        >
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>{t('sos.sosLabel')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  checkInScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  checkInCard: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 24, gap: 12, alignItems: 'center' },
  checkInBtn: { alignSelf: 'stretch', minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  centeredInline: { alignItems: 'center', justifyContent: 'center' },
  mapWrap: { height: 240, position: 'relative' },
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
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'white',
    ...Shadow.md,
  },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  section: { padding: 16, borderRadius: Radius.xl, borderWidth: 1 },
  driverAvatar: { width: 48, height: 48, borderRadius: 14 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  deviationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  ratingWrap: { gap: 16 },
  textBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sosFab: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
});
