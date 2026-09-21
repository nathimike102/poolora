/**
 * screens/rider/ActiveRideScreen.tsx
 *
 * Live view of a booked ride for the rider. Status comes from the ride record
 * (polled), driver position and route-deviation alerts come from the booking's
 * tracking room over Socket.io. Nothing on this screen is simulated.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

import { rideService } from '../../services/rideService';
import { ratingService } from '../../services/ratingService';
import type { Ride } from '../../types/api';
import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveMap } from '../../components/LiveMap';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { Radius, Shadow } from '../../theme';
import { initSocket } from '../../utils/socket';
import { errorHandler } from '../../utils/errorHandler';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const POLL_MS = 15_000;

/** UI labels mapped to the rating tags the backend accepts. */
const RATING_TAGS: { label: string; value: string }[] = [
  { label: 'On time', value: 'punctuality' },
  { label: 'Safe driving', value: 'driving' },
  { label: 'Clean car', value: 'cleanliness' },
  { label: 'Polite', value: 'politeness' },
  { label: 'Good communication', value: 'communication' },
];
const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

function formatTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starRow} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Pressable
          key={s}
          onPress={() => onChange(s)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${s} ${s === 1 ? 'star' : 'stars'}`}
        >
          <Svg width={36} height={36} viewBox="0 0 24 24">
            <Path
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              fill={s <= value ? '#FFB300' : '#D1D5DB'}
            />
          </Svg>
        </Pressable>
      ))}
    </View>
  );
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

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState('');

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

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('driver:location:updated', onLocation);
    socket.on('driver:milestone', onMilestone);
    socket.on('route:deviated', onDeviation);
    return () => {
      socket.emit('tracking:leave', bookingId);
      socket.off('connect', join);
      socket.off('driver:location:updated', onLocation);
      socket.off('driver:milestone', onMilestone);
      socket.off('route:deviated', onDeviation);
    };
  }, [bookingId]);

  const toggleTag = (tag: string) =>
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));

  const submitRating = useCallback(async () => {
    if (!bookingId || rating === 0) return;
    setSubmittingRating(true);
    setRatingError('');
    try {
      await ratingService.submitRating(bookingId, rating, undefined, selectedTags);
      navigation.navigate('RiderTabs', { screen: 'MyRides' });
    } catch (error) {
      setRatingError(errorHandler.process(error).message);
    } finally {
      setSubmittingRating(false);
    }
  }, [bookingId, rating, selectedTags, navigation]);

  const shareTrip = () => {
    if (!ride) return;
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
            <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }} accessibilityRole="header">
              How was your ride with {driverName}?
            </Text>
            <View style={[styles.ratingCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <StarRating value={rating} onChange={setRating} />
              {rating > 0 && (
                <Text style={{ fontSize: 14, color: c.textSec, marginTop: 8 }}>{RATING_LABELS[rating]}</Text>
              )}
            </View>
            <View style={styles.tagsWrap}>
              {RATING_TAGS.map(tag => {
                const selected = selectedTags.includes(tag.value);
                return (
                  <Pressable
                    key={tag.value}
                    onPress={() => toggleTag(tag.value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={[
                      styles.tagChip,
                      { backgroundColor: selected ? c.primaryLight : c.surface, borderColor: selected ? c.primary : c.border },
                    ]}
                  >
                    <Text style={{ fontSize: 13, color: selected ? c.primary : c.text, fontWeight: selected ? '600' : '400' }}>
                      {tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {ratingError ? (
              <Text style={{ color: c.error, textAlign: 'center' }} accessibilityLiveRegion="polite">{ratingError}</Text>
            ) : null}
            {bookingId ? (
              <Pressable
                onPress={submitRating}
                disabled={rating === 0 || submittingRating}
                accessibilityRole="button"
                accessibilityState={{ disabled: rating === 0 || submittingRating }}
                style={[styles.primaryCta, { backgroundColor: rating === 0 ? c.border : c.primary }]}
              >
                {submittingRating ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: rating === 0 ? c.textSec : c.textOnPrimary }}>
                    Submit rating
                  </Text>
                )}
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => navigation.navigate('RiderTabs', { screen: 'MyRides' })}
              accessibilityRole="button"
              style={styles.textBtn}
            >
              <Text style={{ fontSize: 14, color: c.textSec }}>Skip for now</Text>
            </Pressable>
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
                {ride.driver?.phone ? (
                  <Pressable
                    style={[styles.iconBtn, { backgroundColor: c.successLight }]}
                    onPress={() => Linking.openURL(`tel:${ride.driver.phone}`)}
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
                <Text style={{ fontSize: 14, color: c.text, marginLeft: 8 }}>Share trip details</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

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
  ratingCard: { alignItems: 'center', padding: 20, borderRadius: Radius.xl, borderWidth: 1 },
  starRow: { flexDirection: 'row', gap: 8 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5 },
  primaryCta: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
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
