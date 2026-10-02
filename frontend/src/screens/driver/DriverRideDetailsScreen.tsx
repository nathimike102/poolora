/**
 * screens/driver/DriverRideDetailsScreen.tsx
 *
 * A driver's view of one of their rides: route, seats, confirmed riders and
 * the actions to start, complete or cancel the ride. While the ride is under
 * way the phone's GPS position is shared with each confirmed rider. In
 * development builds the server can also send a test rider and drive the car
 * along the route (see simulationService).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Linking, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

import { useApp } from '../../context/AppContext';
import { callOnBooking } from '../../services/callService';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { RideParcels } from '../../components/RideParcels';
import { LiveMap } from '../../components/LiveMap';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';
import { rideService } from '../../services/rideService';
import { bookingService } from '../../services/bookingService';
import { simulationService } from '../../services/simulationService';
import type { Booking, Ride } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';
import { decodePolyline } from '../../utils/polyline';
import { initSocket } from '../../utils/socket';
import { money, REGION } from '../../utils/region';
import { startTripTracking, stopTripTracking } from '../../services/tripTracking';
import { useTranslation } from 'react-i18next';

type Coordinate = { latitude: number; longitude: number };

/** How often a moving phone reports its position to riders. */
const GPS_INTERVAL_MS = 5000;

/** How long the driver waits at a pickup before a no-show can be reported (the server has the final say) */
const NO_SHOW_WAIT_MS = 10 * 60 * 1000;

type LatLng = { lat: number; lng: number };
const pointOf = (place?: { location?: { coordinates: [number, number] } }): LatLng | null =>
  place?.location?.coordinates ? { lng: place.location.coordinates[0], lat: place.location.coordinates[1] } : null;

/**
 * Google Maps turn-by-turn directions through the stops still to come:
 * pickups of riders not yet in the car, then drops of those who are, then
 * the end of the ride (UC-D05).
 */
function directionsUrl(riders: Booking[], end: LatLng): string {
  const stops = [
    ...riders.filter(b => !b.actualPickupTime).map(b => pointOf(b.pickup)),
    ...riders.filter(b => b.actualPickupTime).map(b => pointOf(b.dropoff)),
  ].filter((p): p is LatLng => Boolean(p));
  const params = new URLSearchParams({ api: '1', destination: `${end.lat},${end.lng}`, travelmode: 'driving' });
  if (stops.length) params.set('waypoints', stops.map(p => `${p.lat},${p.lng}`).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function waitLabel(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Send one position to every confirmed rider, over the socket when it is up. */
function shareLocation(bookingIds: string[], point: Coordinate, speedKmh: number, heading: number, accuracy: number) {
  const socket = initSocket();
  for (const bookingId of bookingIds) {
    if (socket.connected) {
      socket.emit('driver:location:update', {
        bookingId,
        location: { type: 'Point', coordinates: [point.longitude, point.latitude] },
        speed: speedKmh,
        heading,
        accuracy,
        timestamp: Date.now(),
      });
    } else {
      rideService
        .updateDriverLocation({ bookingId, lat: point.latitude, lng: point.longitude, speed: speedKmh, heading, accuracy })
        .catch(() => undefined);
    }
  }
}

type Route = RouteProp<RootStackParamList, 'DriverRideDetails'>;

export function DriverRideDetailsScreen() {
  const { rideId } = useRoute<Route>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [ride, setRide] = useState<Ride | null>(null);
  const [riders, setRiders] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [acting, setActing] = useState(false);
  const [carLocation, setCarLocation] = useState<Coordinate | undefined>();
  const [gpsNote, setGpsNote] = useState('');
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [composing, setComposing] = useState(false);
  // "Picked up" asks for the rider's pickup code
  const [pinFor, setPinFor] = useState<Booking | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [broadcast, setBroadcast] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

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

  useEffect(() => {
    simulationService.isEnabled().then(setSimulationEnabled);
  }, []);

  // A clock for the no-show countdown while any rider is being waited for
  const [now, setNow] = useState(Date.now());
  const waiting = riders.some(b => b.driverArrivedAt && !b.actualPickupTime);
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  const status = ride?.status as string | undefined;
  const inProgress = status === 'in_progress';
  const bookingIds = useMemo(() => riders.map(b => b._id), [riders]);
  const bookingIdsRef = useRef(bookingIds);
  bookingIdsRef.current = bookingIds;

  // Share the phone's real position with riders while the ride is under way.
  // The background task keeps sending when Maps is open or the screen is
  // locked; this screen then only moves its own map. If the task cannot run,
  // the screen sends while it is open, as before.
  useEffect(() => {
    if (!inProgress || simulating) return;
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;
    let inBackground = false;
    (async () => {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setGpsNote(t('driverRide.gpsAllow'));
        return;
      }
      setGpsNote('');
      inBackground = await startTripTracking(rideId, 'driver');
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: GPS_INTERVAL_MS, distanceInterval: 10 },
        position => {
          const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          setCarLocation(point);
          if (!inBackground) shareLocation(
            bookingIdsRef.current,
            point,
            Math.max(0, (position.coords.speed ?? 0) * 3.6),
            position.coords.heading ?? 0,
            position.coords.accuracy ?? 0,
          );
        },
      );
      if (cancelled) subscription.remove();
    })().catch(() => setGpsNote(t('driverRide.gpsFailed')));
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [inProgress, simulating, rideId, t]);

  // The trip has ended (or is being simulated): stop sending
  useEffect(() => {
    if (status && (!inProgress || simulating)) stopTripTracking(rideId);
  }, [status, inProgress, simulating, rideId]);

  // Positions of the simulated car, which the server sends to the driver
  useEffect(() => {
    const socket = initSocket();
    const onSimulation = (data: {
      rideId: string;
      phase: string;
      progress: number;
      location?: { lat: number; lng: number };
    }) => {
      if (data.rideId !== rideId) return;
      if (data.location) setCarLocation({ latitude: data.location.lat, longitude: data.location.lng });
      setSimulationProgress(data.progress);
      if (data.phase === 'done') {
        setSimulating(false);
        Alert.alert(t('driverRide.simDoneTitle'), t('driverRide.simDoneBody'));
      } else {
        setSimulating(true);
      }
    };
    socket.on('ride:simulation', onSimulation);
    return () => {
      socket.off('ride:simulation', onSimulation);
    };
  }, [rideId, t]);

  const runNow = async (action: () => Promise<unknown>) => {
    setActing(true);
    try {
      await action();
      await load();
    } catch (error) {
      Alert.alert(t('driverRide.wentWrong'), errorHandler.process(error).message);
    } finally {
      setActing(false);
    }
  };

  const startSimulatedDrive = () =>
    runNow(async () => {
      await simulationService.drive(rideId);
      setSimulating(true);
      setSimulationProgress(0);
    });

  const stopSimulatedDrive = () =>
    runNow(async () => {
      await simulationService.stop(rideId);
      setSimulating(false);
    });

  const requestTestRider = () =>
    runNow(async () => {
      await simulationService.asDriver(undefined, rideId);
      Alert.alert(t('driverRide.testRiderTitle'), t('driverRide.testRiderBody'), [
        { text: t('driverRide.later'), style: 'cancel' },
        { text: t('driverRide.reviewRequest'), onPress: () => navigation.navigate('DriverTabs', { screen: 'ManageRequests' }) },
      ]);
    });

  const route = useMemo(() => decodePolyline(ride?.routePolyline), [ride?.routePolyline]);

  const step = (bookingId: string, which: 'arrived' | 'pickedUp' | 'droppedOff' | 'noShow') => {
    if (which === 'pickedUp') {
      setPin('');
      setPinError('');
      setPinFor(riders.find(b => b._id === bookingId) ?? null);
      return;
    }
    return runNow(() => bookingService.driverStep(bookingId, which));
  };

  const submitPin = async () => {
    if (!pinFor || pin.length !== 4) return;
    setActing(true);
    setPinError('');
    try {
      await bookingService.driverStep(pinFor._id, 'pickedUp', pin);
      setPinFor(null);
      await load();
    } catch (error) {
      // Wrong code: say so in the sheet so the driver can ask again
      setPinError(errorHandler.process(error).message);
      setPin('');
    } finally {
      setActing(false);
    }
  };

  // One message to everyone booked on the ride (UC-D06 step 6)
  const sendBroadcast = async () => {
    const text = broadcast.trim();
    if (!text) return;
    setSendingBroadcast(true);
    try {
      const { sent } = await rideService.messageAllRiders(rideId, text);
      setComposing(false);
      setBroadcast('');
      Alert.alert(t('driverRide.messageSent'), sent === 1 ? t('driverRide.sentToOne') : t('driverRide.sentToMany', { count: sent }));
    } catch (error) {
      Alert.alert(t('common.notSent'), errorHandler.process(error).message);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const openInMaps = () => {
    if (!ride) return;
    Linking.openURL(directionsUrl(riders, { lat: ride.dropoffLocation.lat, lng: ride.dropoffLocation.lng })).catch(() =>
      Alert.alert(t('driverRide.mapsFailedTitle'), t('driverRide.mapsFailedBody')),
    );
  };

  const runAction = (title: string, message: string, confirmLabel: string, action: () => Promise<unknown>) => {
    Alert.alert(title, message, [
      { text: t('driverRide.notNow'), style: 'cancel' },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: async () => {
          setActing(true);
          try {
            await action();
            await load();
          } catch (error) {
            Alert.alert(t('driverRide.wentWrong'), errorHandler.process(error).message);
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
      <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{t('driverRide.title')}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!ride) {
    return (
      <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          {loadError ? (
            <Text style={{ color: c.textSec, fontSize: 15 }}>{t('driverRide.loadFailed')}</Text>
          ) : (
            <ActivityIndicator color={c.primary} accessibilityLabel={t('ride.loading')} />
          )}
        </View>
      </View>
    );
  }

  const departure = new Date(ride.scheduledDeparture);
  const booked = (ride.seats ?? 0) - (ride.availableSeats ?? 0);
  const notStarted = status === 'scheduled' || status === 'active';
  const origin = { latitude: ride.pickupLocation.lat, longitude: ride.pickupLocation.lng };
  const destination = { latitude: ride.dropoffLocation.lat, longitude: ride.dropoffLocation.lng };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {header}

      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.mapCard, { borderColor: c.border }]}>
          <LiveMap
            showRoute
            showDriver={Boolean(carLocation)}
            origin={origin}
            destination={destination}
            route={route}
            driverLocation={carLocation}
          />
        </View>

        {inProgress && (
          <View style={[styles.liveBanner, { backgroundColor: c.primaryLight }]} accessibilityLiveRegion="polite">
            <Icon name={simulating ? 'robot' : 'crosshairs-gps'} size={18} color={c.primary} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.text }}>
              {gpsNote ||
                (simulating
                  ? t('driverRide.simulatedDrive', { percent: Math.round(simulationProgress * 100) })
                  : t('driverRide.ridersFollow'))}
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.sectionLabel, { color: c.textSec }]}>{t('driverRide.route')}</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{ride.pickupLocation.address}</Text>
          <Text style={{ fontSize: 14, color: c.textSec, marginVertical: 4 }}>{t('driverRide.to')}</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{ride.dropoffLocation.address}</Text>
          <View style={styles.infoRow}>
            <Icon name="calendar" size={16} color={c.textSec} />
            <Text style={{ fontSize: 14, color: c.text, marginLeft: 8 }}>
              {t('driverRide.dateAt', {
                date: departure.toLocaleDateString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' }),
                time: departure.toLocaleTimeString(REGION.dateLocale, { hour: '2-digit', minute: '2-digit' }),
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="information-outline" size={16} color={c.textSec} />
            <Text style={{ fontSize: 14, color: c.text, marginLeft: 8 }}>
              {status ? t(`driverRide.status.${status}`, { defaultValue: status.replace('_', ' ') }) : ''}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.sectionLabel, { color: c.textSec }]}>{t('driverRide.seatsBooked')}</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>
                {t('driverRide.bookedOf', { booked, seats: ride.seats })}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: c.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.sectionLabel, { color: c.textSec }]}>{t('driverRide.bookedFares')}</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.successDark }}>
                {money((booked * ride.pricePerSeat))}
              </Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>{t('driverRide.beforeFee')}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.statsRow}>
            <Text style={[styles.sectionLabel, styles.flex1, { color: c.textSec }]}>{t('driverRide.confirmedRiders')}</Text>
            {riders.length > 0 && (notStarted || inProgress) ? (
              <Pressable
                onPress={() => setComposing(true)}
                accessibilityRole="button"
                accessibilityLabel={t('driverRide.messageAllLabel')}
                style={styles.msgAllBtn}
              >
                <Icon name="message-text-outline" size={16} color={c.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>{t('driverRide.messageAll')}</Text>
              </Pressable>
            ) : null}
          </View>
          {riders.length === 0 ? (
            <Text style={{ fontSize: 14, color: c.textSec }}>{t('driverRide.noRiders')}</Text>
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
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{b.rider?.name ?? t('driverRide.rider')}</Text>
                  <Text style={{ fontSize: 12, color: c.textSec, marginTop: 2 }}>
                    {b.seatsBooked === 1 ? t('driverRide.seatOne') : t('driverRide.seatMany', { count: b.seatsBooked })}
                    {b.pickup?.address ? t('driverRide.pickupAt', { address: b.pickup.address }) : ''}
                    {b.dropoff?.address ? t('driverRide.dropAt', { address: b.dropoff.address }) : ''}
                  </Text>
                  {b.note ? (
                    <Text style={{ fontSize: 13, color: c.text, marginTop: 4, fontStyle: 'italic' }}>“{b.note}”</Text>
                  ) : null}
                  {notStarted || inProgress ? (
                    <Pressable
                      onPress={() => callOnBooking(b._id, b.rider?.name ?? t('driverRide.yourRider'))}
                      accessibilityRole="button"
                      accessibilityLabel={t('driverRide.callName', { name: b.rider?.name ?? t('driverRide.riderLower') })}
                      style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>{t('driverRide.call')}</Text>
                    </Pressable>
                  ) : null}
                  {inProgress ? (
                    <RiderSteps
                      booking={b}
                      now={now}
                      busy={acting}
                      colors={c}
                      onStep={which => {
                        if (which === 'noShow') {
                          runAction(
                            t('driverRide.noShowTitle'),
                            t('driverRide.noShowBody', { name: b.rider?.name ?? t('driverRide.theRider') }),
                            t('driverRide.noShowConfirm'),
                            () => bookingService.driverStep(b._id, 'noShow'),
                          );
                        } else {
                          step(b._id, which);
                        }
                      }}
                    />
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        <RideParcels rideId={rideId} />

        {(notStarted || inProgress) && (
          <View style={styles.actions}>
            {notStarted && (
              <>
                <Pressable
                  onPress={() =>
                    runAction(t('driverRide.startTitle'), t('driverRide.startBody'), t('driverRide.start'), () =>
                      rideService.startRide(rideId),
                    )
                  }
                  disabled={acting || riders.length === 0}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: acting || riders.length === 0 }}
                  style={[styles.actionBtn, { backgroundColor: riders.length === 0 ? c.border : c.primary }]}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: riders.length === 0 ? c.textSec : c.textOnPrimary }}>
                    {t('driverRide.start')}
                  </Text>
                </Pressable>
                {riders.length === 0 && (
                  <Text style={{ fontSize: 13, color: c.textSec, textAlign: 'center' }}>
                    {t('driverRide.acceptFirst')}
                  </Text>
                )}
              </>
            )}
            {inProgress && (
              <Pressable
                onPress={openInMaps}
                accessibilityRole="button"
                style={[styles.devBtn, { borderColor: c.primary }]}
              >
                <Icon name="navigation-variant-outline" size={18} color={c.primary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>{t('driverRide.openMaps')}</Text>
              </Pressable>
            )}
            {inProgress && (
              <Pressable
                onPress={() =>
                  runAction(t('driverRide.completeTitle'), t('driverRide.completeBody'), t('driverRide.complete'), () =>
                    rideService.completeRide(rideId),
                  )
                }
                disabled={acting}
                accessibilityRole="button"
                style={[styles.actionBtn, { backgroundColor: c.primary }]}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>{t('driverRide.complete')}</Text>
              </Pressable>
            )}

            {simulationEnabled && (
              <View style={[styles.devCard, { borderColor: c.border }]}>
                <Text style={[styles.sectionLabel, { color: c.textSec }]}>{t('driverRide.testingTools')}</Text>
                {notStarted && (
                  <Pressable
                    onPress={requestTestRider}
                    disabled={acting || (ride.availableSeats ?? 0) < 1}
                    accessibilityRole="button"
                    style={[styles.devBtn, { borderColor: c.primary }]}
                  >
                    <Icon name="account-plus-outline" size={18} color={c.primary} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>{t('driverRide.testRider')}</Text>
                  </Pressable>
                )}
                {inProgress && (
                  <Pressable
                    onPress={simulating ? stopSimulatedDrive : startSimulatedDrive}
                    disabled={acting}
                    accessibilityRole="button"
                    style={[styles.devBtn, { borderColor: c.primary }]}
                  >
                    <Icon name={simulating ? 'stop-circle-outline' : 'play-circle-outline'} size={18} color={c.primary} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>
                      {simulating ? t('driverRide.stopSim') : t('driverRide.startSim')}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {notStarted && (
              <Pressable
                onPress={() => navigation.navigate('EditRide', { rideId })}
                disabled={acting}
                accessibilityRole="button"
                style={[styles.devBtn, { borderColor: c.border }]}
              >
                <Icon name="pencil-outline" size={18} color={c.text} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{t('driverRide.change')}</Text>
              </Pressable>
            )}
            {notStarted && (
              <Pressable
                onPress={() =>
                  runAction(
                    t('driverRide.cancelTitle'),
                    t('driverRide.cancelBody'),
                    t('driverRide.cancelRide'),
                    () => rideService.cancelRide(rideId),
                  )
                }
                disabled={acting}
                accessibilityRole="button"
                style={[styles.actionBtn, { backgroundColor: c.errorLight }]}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.error }}>{t('driverRide.cancelRide')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={Boolean(pinFor)} transparent animationType="slide" onRequestClose={() => setPinFor(null)}>
        <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }} accessibilityRole="header">
              {t('driverRide.pinTitle', { name: pinFor?.rider?.name?.split(' ')[0] ?? t('driverRide.theRider') })}
            </Text>
            <Text style={{ fontSize: 13, color: c.textSec }}>
              {t('driverRide.pinHelp')}
            </Text>
            <TextInput
              value={pin}
              onChangeText={text => setPin(text.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              accessibilityLabel={t('driverRide.pinLabel')}
              style={[styles.sheetInput, { borderColor: pinError ? c.error : c.border, color: c.text, backgroundColor: c.bg, fontSize: 28, letterSpacing: 12, textAlign: 'center', minHeight: 64 }]}
            />
            {pinError ? <Text style={{ fontSize: 13, color: c.error }} accessibilityLiveRegion="assertive">{pinError}</Text> : null}
            <View style={styles.statsRow}>
              <Pressable onPress={() => setPinFor(null)} accessibilityRole="button" style={[styles.actionBtn, styles.flex1]}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: c.textSec }}>{t('driverRide.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={submitPin}
                disabled={pin.length !== 4 || acting}
                accessibilityRole="button"
                style={[styles.actionBtn, styles.flex1, { backgroundColor: pin.length === 4 ? c.primary : c.border }]}
              >
                {acting ? <ActivityIndicator color={c.textOnPrimary} /> : (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: pin.length === 4 ? c.textOnPrimary : c.textSec }}>{t('driverRide.confirmPickup')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={composing} transparent animationType="slide" onRequestClose={() => setComposing(false)}>
        <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }} accessibilityRole="header">{t('driverRide.messageAllLabel')}</Text>
            <Text style={{ fontSize: 13, color: c.textSec }}>
              {riders.length === 1 ? t('driverRide.broadcastHelpOne') : t('driverRide.broadcastHelpMany', { count: riders.length })}
            </Text>
            <View style={styles.templateRow}>
              {BROADCAST_TEMPLATES.map(key => t(`driverRide.templates.${key}`)).map(template => (
                <Pressable
                  key={template}
                  onPress={() => setBroadcast(template)}
                  accessibilityRole="button"
                  style={[styles.template, { borderColor: c.border, backgroundColor: c.bg }]}
                >
                  <Text style={{ fontSize: 13, color: c.text }}>{template}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={broadcast}
              onChangeText={setBroadcast}
              multiline
              maxLength={2000}
              autoFocus
              placeholder={t('driverRide.broadcastPlaceholder')}
              placeholderTextColor={c.textSec}
              accessibilityLabel={t('driverRide.messageLabel')}
              style={[styles.sheetInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            <View style={styles.statsRow}>
              <Pressable onPress={() => setComposing(false)} accessibilityRole="button" style={[styles.actionBtn, styles.flex1]}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: c.textSec }}>{t('driverRide.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={sendBroadcast}
                disabled={!broadcast.trim() || sendingBroadcast}
                accessibilityRole="button"
                style={[styles.actionBtn, styles.flex1, { backgroundColor: broadcast.trim() ? c.primary : c.border }]}
              >
                {sendingBroadcast ? <ActivityIndicator color={c.textOnPrimary} /> : (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: broadcast.trim() ? c.textOnPrimary : c.textSec }}>{t('driverRide.send')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Drivers need SOS too; it is about a rider on this ride, one in the car if any */}
      {riders.length > 0 && (status === 'scheduled' || inProgress) && (
        <Pressable
          onPress={() => navigation.navigate('SOS', { bookingId: (riders.find(b => b.actualPickupTime && !b.actualDropoffTime) ?? riders[0])._id })}
          accessibilityRole="button"
          accessibilityLabel={t('ride.sosLabel')}
          style={[styles.sosFab, { backgroundColor: c.error }]}
        >
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>{t('sos.sosLabel')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Quick messages to all riders; the words are in the catalogue under driverRide.templates */
const BROADCAST_TEMPLATES = ['late', 'onTime', 'early'] as const;

/**
 * The next step for one rider during the ride (UC-D04): at the pickup, in
 * the car, dropped. While waiting at the pickup a countdown runs; once it
 * ends the driver can report a no-show (UC-D07).
 */
function RiderSteps({
  booking,
  now,
  busy,
  colors: c,
  onStep,
}: {
  booking: Booking;
  now: number;
  busy: boolean;
  colors: ReturnType<typeof useApp>['c'];
  onStep: (which: 'arrived' | 'pickedUp' | 'droppedOff' | 'noShow') => void;
}) {
  const { t } = useTranslation();
  const button = (label: string, which: 'arrived' | 'pickedUp' | 'droppedOff' | 'noShow', primary: boolean, disabled = false) => (
    <Pressable
      key={which}
      onPress={() => onStep(which)}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || disabled }}
      style={[
        styles.stepBtn,
        primary ? { backgroundColor: c.primary } : { borderWidth: 1.5, borderColor: disabled ? c.border : c.error },
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: primary ? c.textOnPrimary : disabled ? c.textSec : c.error }}>{label}</Text>
    </Pressable>
  );

  if (booking.actualPickupTime) {
    return <View style={styles.stepRow}>{button(t('driverRide.steps.droppedOff'), 'droppedOff', true)}</View>;
  }
  if (!booking.driverArrivedAt) {
    return <View style={styles.stepRow}>{button(t('driverRide.steps.atPickup'), 'arrived', true)}</View>;
  }
  const left = new Date(booking.driverArrivedAt).getTime() + NO_SHOW_WAIT_MS - now;
  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      <Text style={{ fontSize: 12, color: c.textSec }} accessibilityLiveRegion="polite">
        {left > 0 ? t('driverRide.steps.waiting', { time: waitLabel(left) }) : t('driverRide.steps.waitedEnough')}
      </Text>
      <View style={styles.stepRow}>
        {button(t('driverRide.steps.pickedUp'), 'pickedUp', true)}
        {button(t('driverRide.steps.noShow'), 'noShow', false, left > 0)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sosFab: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
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
  mapCard: { height: 220, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  liveBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  actions: { gap: 12 },
  devCard: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 12, gap: 10 },
  devBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  msgAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 8 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  template: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  sheetInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 90, textAlignVertical: 'top', fontSize: 15 },
  stepBtn: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
