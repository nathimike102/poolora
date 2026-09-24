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
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
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

  // Share the phone's real position with riders while the ride is under way
  useEffect(() => {
    if (!inProgress || simulating) return;
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;
    (async () => {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setGpsNote('Allow location access so riders can follow your car.');
        return;
      }
      setGpsNote('');
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: GPS_INTERVAL_MS, distanceInterval: 10 },
        position => {
          const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          setCarLocation(point);
          shareLocation(
            bookingIdsRef.current,
            point,
            Math.max(0, (position.coords.speed ?? 0) * 3.6),
            position.coords.heading ?? 0,
            position.coords.accuracy ?? 0,
          );
        },
      );
      if (cancelled) subscription.remove();
    })().catch(() => setGpsNote('Your location could not be shared. Check that location is on.'));
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [inProgress, simulating]);

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
        Alert.alert('You have reached the drop', 'Complete the ride so your riders can pay and rate the trip.');
      } else {
        setSimulating(true);
      }
    };
    socket.on('ride:simulation', onSimulation);
    return () => {
      socket.off('ride:simulation', onSimulation);
    };
  }, [rideId]);

  const runNow = async (action: () => Promise<unknown>) => {
    setActing(true);
    try {
      await action();
      await load();
    } catch (error) {
      Alert.alert('Something went wrong', errorHandler.process(error).message);
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
      Alert.alert('A test rider asked for a seat', 'Sim Rider has paid from their wallet. Accept the request, then start the ride.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Review request', onPress: () => navigation.navigate('DriverTabs', { screen: 'ManageRequests' }) },
      ]);
    });

  const route = useMemo(() => decodePolyline(ride?.routePolyline), [ride?.routePolyline]);

  const step = (bookingId: string, which: 'arrived' | 'pickedUp' | 'droppedOff' | 'noShow') =>
    runNow(() => bookingService.driverStep(bookingId, which));

  // One message to everyone booked on the ride (UC-D06 step 6)
  const sendBroadcast = async () => {
    const text = broadcast.trim();
    if (!text) return;
    setSendingBroadcast(true);
    try {
      const { sent } = await rideService.messageAllRiders(rideId, text);
      setComposing(false);
      setBroadcast('');
      Alert.alert('Message sent', `Sent to ${sent} ${sent === 1 ? 'rider' : 'riders'}. Replies arrive in your chats.`);
    } catch (error) {
      Alert.alert('Not sent', errorHandler.process(error).message);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const openInMaps = () => {
    if (!ride) return;
    Linking.openURL(directionsUrl(riders, { lat: ride.dropoffLocation.lat, lng: ride.dropoffLocation.lng })).catch(() =>
      Alert.alert('Maps did not open', 'Install Google Maps, or open the route in your maps app by hand.'),
    );
  };

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
                  ? `Simulated drive: ${Math.round(simulationProgress * 100)}% of the route`
                  : 'Riders can follow your car live.')}
            </Text>
          </View>
        )}

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
              {(status ?? '').replace('_', ' ')}
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
          <View style={styles.statsRow}>
            <Text style={[styles.sectionLabel, styles.flex1, { color: c.textSec }]}>Confirmed riders</Text>
            {riders.length > 0 && (notStarted || inProgress) ? (
              <Pressable
                onPress={() => setComposing(true)}
                accessibilityRole="button"
                accessibilityLabel="Message all riders"
                style={styles.msgAllBtn}
              >
                <Icon name="message-text-outline" size={16} color={c.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>Message all</Text>
              </Pressable>
            ) : null}
          </View>
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
                    {b.dropoff?.address ? ` · Drop: ${b.dropoff.address}` : ''}
                  </Text>
                  {b.note ? (
                    <Text style={{ fontSize: 13, color: c.text, marginTop: 4, fontStyle: 'italic' }}>“{b.note}”</Text>
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
                            'Report a no-show?',
                            `${b.rider?.name ?? 'The rider'} did not come. Their booking is cancelled and you keep the fare, less the platform fee.`,
                            'Report no-show',
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

        {(notStarted || inProgress) && (
          <View style={styles.actions}>
            {notStarted && (
              <>
                <Pressable
                  onPress={() =>
                    runAction('Start this ride?', 'Your riders are told you are on the way and can follow your car.', 'Start ride', () =>
                      rideService.startRide(rideId),
                    )
                  }
                  disabled={acting || riders.length === 0}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: acting || riders.length === 0 }}
                  style={[styles.actionBtn, { backgroundColor: riders.length === 0 ? c.border : c.primary }]}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: riders.length === 0 ? c.textSec : c.textOnPrimary }}>
                    Start ride
                  </Text>
                </Pressable>
                {riders.length === 0 && (
                  <Text style={{ fontSize: 13, color: c.textSec, textAlign: 'center' }}>
                    Accept a rider's request to start this ride.
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
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>Open route in Maps</Text>
              </Pressable>
            )}
            {inProgress && (
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
            )}

            {simulationEnabled && (
              <View style={[styles.devCard, { borderColor: c.border }]}>
                <Text style={[styles.sectionLabel, { color: c.textSec }]}>Testing tools</Text>
                {notStarted && (
                  <Pressable
                    onPress={requestTestRider}
                    disabled={acting || (ride.availableSeats ?? 0) < 1}
                    accessibilityRole="button"
                    style={[styles.devBtn, { borderColor: c.primary }]}
                  >
                    <Icon name="account-plus-outline" size={18} color={c.primary} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>Get a test rider request</Text>
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
                      {simulating ? 'Stop simulated drive' : 'Simulate the drive'}
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
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Change time, seats or price</Text>
              </Pressable>
            )}
            {notStarted && (
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
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={composing} transparent animationType="slide" onRequestClose={() => setComposing(false)}>
        <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }} accessibilityRole="header">Message all riders</Text>
            <Text style={{ fontSize: 13, color: c.textSec }}>
              Goes to each of your {riders.length} {riders.length === 1 ? 'rider' : 'riders'} in their chat with you.
            </Text>
            <View style={styles.templateRow}>
              {BROADCAST_TEMPLATES.map(t => (
                <Pressable
                  key={t}
                  onPress={() => setBroadcast(t)}
                  accessibilityRole="button"
                  style={[styles.template, { borderColor: c.border, backgroundColor: c.bg }]}
                >
                  <Text style={{ fontSize: 13, color: c.text }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={broadcast}
              onChangeText={setBroadcast}
              multiline
              maxLength={2000}
              autoFocus
              placeholder="Running 10 minutes late, sorry!"
              placeholderTextColor={c.textSec}
              accessibilityLabel="Message"
              style={[styles.sheetInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            <View style={styles.statsRow}>
              <Pressable onPress={() => setComposing(false)} accessibilityRole="button" style={[styles.actionBtn, styles.flex1]}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: c.textSec }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={sendBroadcast}
                disabled={!broadcast.trim() || sendingBroadcast}
                accessibilityRole="button"
                style={[styles.actionBtn, styles.flex1, { backgroundColor: broadcast.trim() ? c.primary : c.border }]}
              >
                {sendingBroadcast ? <ActivityIndicator color={c.textOnPrimary} /> : (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: broadcast.trim() ? c.textOnPrimary : c.textSec }}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const BROADCAST_TEMPLATES = [
  'Running about 10 minutes late, sorry!',
  'Leaving on time, see you soon.',
  'Please be at your pickup point 5 minutes early.',
];

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
    return <View style={styles.stepRow}>{button('Dropped off', 'droppedOff', true)}</View>;
  }
  if (!booking.driverArrivedAt) {
    return <View style={styles.stepRow}>{button("I'm at the pickup", 'arrived', true)}</View>;
  }
  const left = new Date(booking.driverArrivedAt).getTime() + NO_SHOW_WAIT_MS - now;
  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      <Text style={{ fontSize: 12, color: c.textSec }} accessibilityLiveRegion="polite">
        {left > 0 ? `Waiting for the rider · no-show can be reported in ${waitLabel(left)}` : 'You have waited long enough to report a no-show.'}
      </Text>
      <View style={styles.stepRow}>
        {button('Picked up', 'pickedUp', true)}
        {button('No-show', 'noShow', false, left > 0)}
      </View>
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
