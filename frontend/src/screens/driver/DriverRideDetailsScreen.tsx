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
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
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
});
