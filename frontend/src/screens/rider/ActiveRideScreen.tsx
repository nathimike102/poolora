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
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Linking,
  Share,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { rideService } from '../../services/rideService';
import { bookingService } from '../../services/bookingService';
import { safetyService } from '../../services/safetyService';
import { ratingService, type RatingInput } from '../../services/ratingService';
import { RatingForm } from '../../components/RatingForm';
import type { Ride } from '../../types/api';
import { useApp } from '../../context/AppContext';
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

type Nav = NativeStackNavigationProp<RootStackParamList>;

const POLL_MS = 15_000;

function formatTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ActiveRideScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const { rideId, bookingId } = useRoute<RouteProp<RootStackParamList, 'ActiveRide'>>().params;

  const [ride, setRide] = useState<Ride | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [driverUpdate, setDriverUpdate] = useState<string>('');
  const [deviationMessage, setDeviationMessage] = useState<string>('');
  // An in-ride "Are you OK?" prompt waiting for an answer (UC-R05)
  const [checkIn, setCheckIn] = useState<{ repeat: boolean } | null>(null);
  const [answering, setAnswering] = useState(false);
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

  // A prompt may be waiting when the rider opens the app from the push
  useEffect(() => {
    if (!bookingId) return;
    bookingService
      .getRiderBookings(1, 20, 'confirmed')
      .then(page => {
        const mine = (page.data?.items ?? []).find(b => b._id === bookingId) as
          | { safetyCheck?: { promptedAt?: string; answeredAt?: string; missed?: number } }
          | undefined;
        const check = mine?.safetyCheck;
        if (check?.promptedAt && (!check.answeredAt || check.answeredAt < check.promptedAt)) {
          setCheckIn({ repeat: (check.missed ?? 0) > 0 });
        }
      })
      .catch(() => undefined);
  }, [bookingId]);

  const answerCheckIn = async (status: 'ok' | 'help') => {
    if (!bookingId) return;
    setAnswering(true);
    try {
      await safetyService.answerRideCheckIn(bookingId, status);
      setCheckIn(null);
      if (status === 'help') {
        Alert.alert('Help is on the way', 'The Poolora safety team and your emergency contacts have been alerted with your location.');
      }
    } catch (error) {
      Alert.alert('Not sent', `${errorHandler.process(error).message} If you are in danger, use SOS or call 112.`);
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
      setDriverUpdate(new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    const onMilestone = (data: { bookingId: string; message: string }) => {
      if (data.bookingId === bookingId) setDriverUpdate(data.message);
    };
    const onDeviation = (data: { bookingId: string; message: string }) => {
      if (data.bookingId === bookingId) setDeviationMessage(data.message);
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
  }, [bookingId]);

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
          message: `Follow my Poolora ride from ${ride.pickupLocation.address} to ${ride.dropoffLocation.address} live: ${url}\nThe link stops working an hour after I arrive.`,
        });
        return;
      } catch {
        // fall through to the text-only message
      }
    }
    const plate = ride.vehicle?.plateNumber ? ` (${ride.vehicle.plateNumber})` : '';
    Share.share({
      message:
        `I'm on a Poolora ride with ${ride.driver?.name ?? 'my driver'}${plate} ` +
        `from ${ride.pickupLocation.address} to ${ride.dropoffLocation.address}, ` +
        `leaving at ${formatTime(ride.scheduledDeparture)}.`,
    });
  };

  if (!ride) {
    return (
      <View style={[styles.centered, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        {loadError ? (
          <>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>We couldn't load this ride</Text>
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={styles.textBtn}>
              <Text style={{ fontSize: 15, color: c.primary, fontWeight: '600' }}>Go back</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={c.primary} accessibilityLabel="Loading ride" />
        )}
      </View>
    );
  }

  const status = ride.status as string;
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const inProgress = status === 'in_progress';
  const statusLabel = isCompleted
    ? 'Ride completed'
    : isCancelled
      ? 'Ride cancelled'
      : inProgress
        ? 'Ride in progress'
        : `Departs at ${formatTime(ride.scheduledDeparture)}`;
  const driverName = ride.driver?.name ?? 'Your driver';
  const driverPhone = realPhone(ride.driver?.phone);

  const origin = { latitude: ride.pickupLocation.lat, longitude: ride.pickupLocation.lng };
  const destination = { latitude: ride.dropoffLocation.lat, longitude: ride.dropoffLocation.lng };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
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
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Icon name="arrow-left" size={20} color="#1A1A2E" />
          </Pressable>
          <View style={styles.statusChip} accessibilityLiveRegion="polite">
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>{statusLabel}</Text>
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
                style={[styles.shareBtn, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Icon name="receipt" size={18} color={c.textSec} />
                <Text style={{ fontSize: 14, color: c.text, marginLeft: 8 }}>View receipt</Text>
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
                    If you feel unsafe, use the SOS button.
                  </Text>
                </View>
                <Pressable onPress={() => setDeviationMessage('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss alert">
                  <Icon name="close" size={18} color="#9A3412" />
                </Pressable>
              </View>
            ) : null}

            {/* Trip */}
            <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.textSec }}>Pickup</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{ride.pickupLocation.address}</Text>
              <Text style={{ fontSize: 13, color: c.primary }}>{formatTime(ride.scheduledDeparture)}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.textSec, marginTop: 12 }}>Drop</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{ride.dropoffLocation.address}</Text>
              {ride.estimatedArrival ? (
                <Text style={{ fontSize: 13, color: c.textSec }}>Estimated arrival {formatTime(ride.estimatedArrival)}</Text>
              ) : null}
              {driverUpdate ? (
                <Text style={{ fontSize: 13, color: c.text, marginTop: 12 }} accessibilityLiveRegion="polite">
                  Driver update: {driverUpdate}
                </Text>
              ) : null}
            </View>

            {/* Driver card */}
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              {ride.driver?.profilePhotoUrl ? (
                <Image source={{ uri: ride.driver.profilePhotoUrl }} style={styles.driverAvatar} />
              ) : (
                <View style={[styles.driverAvatar, styles.centeredInline, { backgroundColor: c.primaryLight }]}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: c.primary }}>{driverName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.flex1}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{driverName}</Text>
                {ride.vehicle?.plateNumber ? (
                  <Text style={{ fontSize: 13, color: c.textSec }}>{ride.vehicle.plateNumber}</Text>
                ) : null}
              </View>
              <View style={styles.actionBtns}>
                {driverPhone || bookingId ? (
                  <Pressable
                    style={[styles.iconBtn, { backgroundColor: c.successLight }]}
                    onPress={() => (bookingId ? callOnBooking(bookingId, driverName, driverPhone) : Linking.openURL(`tel:${driverPhone}`))}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${driverName}`}
                  >
                    <Icon name="phone" size={20} color={c.success} />
                  </Pressable>
                ) : null}
                {bookingId ? (
                  <Pressable
                    style={[styles.iconBtn, { backgroundColor: c.primaryLight }]}
                    onPress={() => navigation.navigate('Chat', { chatId: bookingId, recipientName: driverName })}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${driverName}`}
                  >
                    <Icon name="message-text" size={20} color={c.primary} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {!isCancelled && (
              <Pressable
                onPress={shareTrip}
                accessibilityRole="button"
                style={[styles.shareBtn, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Icon name="share-variant" size={18} color={c.textSec} />
                <Text style={{ fontSize: 14, color: c.text, marginLeft: 8 }}>Share a live trip link</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={Boolean(checkIn)} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.checkInScrim}>
          <View style={[styles.checkInCard, { backgroundColor: c.surface }]} accessibilityViewIsModal>
            <Icon name="shield-check" size={36} color={c.primary} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }} accessibilityRole="header">
              {checkIn?.repeat ? 'Please confirm you are OK' : 'Are you OK?'}
            </Text>
            <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center' }}>
              {checkIn?.repeat
                ? 'We did not hear back. If you do not answer, we will alert the safety team.'
                : 'A quick safety check during your ride.'}
            </Text>
            <Pressable
              onPress={() => answerCheckIn('ok')}
              disabled={answering}
              accessibilityRole="button"
              style={[styles.checkInBtn, { backgroundColor: c.primary }]}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>I'm OK</Text>
            </Pressable>
            <Pressable
              onPress={() => answerCheckIn('help')}
              disabled={answering}
              accessibilityRole="button"
              style={[styles.checkInBtn, { backgroundColor: c.errorLight }]}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.error }}>I need help</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {!isCompleted && !isCancelled && (
        <Pressable
          onPress={() => navigation.navigate('SOS')}
          accessibilityRole="button"
          accessibilityLabel="SOS emergency"
          style={[styles.sosFab, { backgroundColor: c.error }]}
        >
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>SOS</Text>
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
