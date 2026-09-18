/**
 * screens/driver/CreateRideScreen.tsx
 *
 * Publishes a ride offer. Places come from backend place search, the vehicle
 * must be one of the driver's verified vehicles, and the ride is only shown
 * as published after the API accepts it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { Icon } from '../../components/Icon';
import { RideDatePicker } from '../../components/RideDatePicker';
import { ClockTimePicker } from '../../components/ClockTimePicker';
import { fetchPlaceSuggestions, geocodePlace, suggestionLabel, type PlaceSuggestion } from '../../services/placesService';
import { rideService } from '../../services/rideService';
import { userService } from '../../services/userService';
import { errorHandler } from '../../utils/errorHandler';
import { Radius, Spacing, Typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import type { Ride, User, Vehicle } from '../../types/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Field = 'from' | 'to';
type Luggage = 'none' | 'small' | 'medium' | 'large';

const MAX_SEATS = 6;
const SUGGESTION_DEBOUNCE_MS = 300;
const LUGGAGE: { value: Luggage; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

function formatDate(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function CreateRideScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<User | null>(null);
  const [profileError, setProfileError] = useState(false);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestRequest = useRef(0);

  const [date, setDate] = useState<Date>(() => new Date());
  const [time, setTime] = useState('08:30');
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [luggage, setLuggage] = useState<Luggage>('medium');

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState<Ride | null>(null);

  useFocusEffect(
    useCallback(() => {
      userService
        .getMyProfile()
        .then(p => {
          setProfile(p);
          setProfileError(false);
          if (p.vehicles?.length === 1) setVehicleId(p.vehicles[0]._id);
        })
        .catch(() => setProfileError(true));
    }, []),
  );

  useEffect(() => () => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
  }, []);

  const requestSuggestions = (text: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      const id = ++suggestRequest.current;
      try {
        const results = await fetchPlaceSuggestions(text);
        if (id === suggestRequest.current) setSuggestions(results);
      } catch {
        if (id === suggestRequest.current) setSuggestions([]);
      }
    }, SUGGESTION_DEBOUNCE_MS);
  };

  const onChange = (field: Field, text: string) => {
    setActiveField(field);
    if (field === 'from') setFrom(text);
    else setTo(text);
    requestSuggestions(text);
  };

  const pick = (place: PlaceSuggestion) => {
    if (activeField === 'from') setFrom(suggestionLabel(place));
    else setTo(suggestionLabel(place));
    setSuggestions([]);
    setActiveField(null);
  };

  const departure = (() => {
    const d = new Date(date);
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  })();

  const priceNumber = Number(price);
  const vehicles: Vehicle[] = profile?.vehicles ?? [];
  const kycApproved = profile?.kyc?.status === 'approved';
  const canPublish =
    kycApproved &&
    from.trim().length > 2 &&
    to.trim().length > 2 &&
    Boolean(vehicleId) &&
    price !== '' &&
    Number.isFinite(priceNumber) &&
    priceNumber >= 0 &&
    departure.getTime() > Date.now() &&
    !publishing;

  const publish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setError('');
    try {
      const [pickup, dropoff] = await Promise.all([geocodePlace(from), geocodePlace(to)]);
      const ride = await rideService.createRide({
        vehicleId,
        pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.formattedAddress },
        dropoff: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.formattedAddress },
        departureTime: departure.toISOString(),
        totalSeats: seats,
        pricePerSeat: Math.round(priceNumber),
        preferences: { womenOnly, smokingAllowed, petsAllowed, luggageSize: luggage },
      });
      setPublished(ride);
    } catch (err) {
      setError(errorHandler.process(err).message);
    } finally {
      setPublishing(false);
    }
  };

  const reset = () => {
    setPublished(null);
    setFrom('');
    setTo('');
    setPrice('');
  };

  // ── Published ────────────────────────────────────────────────────
  if (published) {
    return (
      <View style={[styles.centered, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={[styles.doneBadge, { backgroundColor: c.success }]}>
          <Icon name="check" size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.doneTitle, { color: c.text }]} accessibilityLiveRegion="polite">Ride published</Text>
        <Text style={[styles.doneBody, { color: c.textSec }]}>
          {published.pickupLocation.address} to {published.dropoffLocation.address}
        </Text>
        <Text style={[styles.doneBody, { color: c.textSec }]}>
          {formatDate(new Date(published.scheduledDeparture))} at{' '}
          {new Date(published.scheduledDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
          {published.seats} seats · ₹{published.pricePerSeat} per seat
        </Text>
        <Pressable
          onPress={() => navigation.navigate('DriverRideDetails', { rideId: published._id })}
          accessibilityRole="button"
          style={[styles.primaryBtn, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>View ride</Text>
        </Pressable>
        <Pressable onPress={reset} accessibilityRole="button" style={styles.textBtn}>
          <Text style={{ fontSize: 15, color: c.primary, fontWeight: '600' }}>Offer another ride</Text>
        </Pressable>
      </View>
    );
  }

  // ── Not verified yet ─────────────────────────────────────────────
  if (profile && !kycApproved) {
    const pending = profile.kyc?.status === 'pending';
    return (
      <View style={[styles.centered, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <Icon name="card-account-details-outline" size={48} color={c.primary} />
        <Text style={[styles.doneTitle, { color: c.text }]}>
          {pending ? 'Verification in review' : 'Verify to offer rides'}
        </Text>
        <Text style={[styles.doneBody, { color: c.textSec }]}>
          {pending
            ? 'You can publish rides once our team approves your licence and vehicle documents.'
            : 'Riders can only book drivers whose licence and vehicle documents have been checked.'}
        </Text>
        {!pending && (
          <Pressable
            onPress={() => navigation.navigate('KYC')}
            accessibilityRole="button"
            style={[styles.primaryBtn, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>Start verification</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const renderSuggestions = (field: Field) =>
    activeField === field && suggestions.length > 0 ? (
      <View style={[styles.suggestions, { backgroundColor: c.surface, borderColor: c.border }]}>
        {suggestions.map(place => (
          <Pressable
            key={place.placeId}
            onPress={() => pick(place)}
            accessibilityRole="button"
            style={styles.suggestionRow}
          >
            <Icon name="map-marker-outline" size={16} color={c.textSec} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: c.text }} numberOfLines={1}>{place.name}</Text>
              {place.subtitle ? (
                <Text style={{ fontSize: 12, color: c.textSec }} numberOfLines={1}>{place.subtitle}</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    ) : null;

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Offer a ride</Text>
      </View>

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {profileError && (
            <Text style={{ color: c.error, fontSize: 14 }}>
              Your driver profile could not be loaded. Check your connection.
            </Text>
          )}

          {/* Route */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textSec }]}>Leaving from</Text>
            <TextInput
              value={from}
              onChangeText={t => onChange('from', t)}
              onFocus={() => setActiveField('from')}
              placeholder="Starting point"
              placeholderTextColor={c.textSec}
              accessibilityLabel="Leaving from"
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            {renderSuggestions('from')}
            <Text style={[styles.label, { color: c.textSec, marginTop: Spacing.md }]}>Going to</Text>
            <TextInput
              value={to}
              onChangeText={t => onChange('to', t)}
              onFocus={() => setActiveField('to')}
              placeholder="Destination"
              placeholderTextColor={c.textSec}
              accessibilityLabel="Going to"
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            {renderSuggestions('to')}
          </View>

          {/* When */}
          <View style={[styles.card, styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Pressable
              onPress={() => setShowDate(true)}
              accessibilityRole="button"
              accessibilityLabel={`Date, ${formatDate(date)}`}
              style={[styles.pickerBtn, { borderColor: c.border, backgroundColor: c.bg }]}
            >
              <Icon name="calendar" size={18} color={c.primary} />
              <Text style={{ fontSize: 15, color: c.text }}>{formatDate(date)}</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTime(true)}
              accessibilityRole="button"
              accessibilityLabel={`Time, ${formatTime(time)}`}
              style={[styles.pickerBtn, { borderColor: c.border, backgroundColor: c.bg }]}
            >
              <Icon name="clock-outline" size={18} color={c.primary} />
              <Text style={{ fontSize: 15, color: c.text }}>{formatTime(time)}</Text>
            </Pressable>
          </View>

          {/* Seats and price */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textSec }]}>Seats to offer</Text>
            <View style={styles.row} accessibilityRole="radiogroup">
              {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map(n => {
                const selected = seats === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setSeats(n)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.seatBtn, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primaryLight : c.bg }]}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: selected ? c.primary : c.text }}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: c.textSec, marginTop: Spacing.md }]}>Price per seat (₹)</Text>
            <TextInput
              value={price}
              onChangeText={t => setPrice(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="For example, 150"
              placeholderTextColor={c.textSec}
              accessibilityLabel="Price per seat in rupees"
              maxLength={5}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            {price !== '' && (
              <Text style={{ fontSize: 13, color: c.textSec, marginTop: 6 }}>
                ₹{(priceNumber * seats).toLocaleString('en-IN')} if every seat is booked, before the platform fee.
              </Text>
            )}
          </View>

          {/* Vehicle */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textSec }]}>Vehicle</Text>
            {vehicles.length === 0 ? (
              <Text style={{ fontSize: 14, color: c.textSec }}>
                No verified vehicles on your account. Vehicles are added during driver verification.
              </Text>
            ) : (
              vehicles.map(v => {
                const selected = v._id === vehicleId;
                return (
                  <Pressable
                    key={v._id}
                    onPress={() => setVehicleId(v._id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.vehicleRow, { borderColor: selected ? c.primary : c.border }]}
                  >
                    <Icon name="car" size={20} color={c.textSec} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>
                        {v.make} {v.model}
                      </Text>
                      <Text style={{ fontSize: 13, color: c.textSec }}>
                        {v.color} · {v.plateNumber}
                      </Text>
                    </View>
                    <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={selected ? c.primary : c.textSec} />
                  </Pressable>
                );
              })
            )}
          </View>

          {/* Preferences */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textSec }]}>Ride rules</Text>
            {[
              { label: 'Women passengers only', value: womenOnly, set: setWomenOnly },
              { label: 'Smoking allowed', value: smokingAllowed, set: setSmokingAllowed },
              { label: 'Pets allowed', value: petsAllowed, set: setPetsAllowed },
            ].map(p => (
              <View key={p.label} style={styles.switchRow}>
                <Text style={{ fontSize: 15, color: c.text, flex: 1 }}>{p.label}</Text>
                <Switch
                  value={p.value}
                  onValueChange={p.set}
                  accessibilityLabel={p.label}
                  trackColor={{ false: c.border, true: c.primary }}
                />
              </View>
            ))}
            <Text style={[styles.label, { color: c.textSec, marginTop: Spacing.sm }]}>Luggage space</Text>
            <View style={styles.row} accessibilityRole="radiogroup">
              {LUGGAGE.map(l => {
                const selected = luggage === l.value;
                return (
                  <Pressable
                    key={l.value}
                    onPress={() => setLuggage(l.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primaryLight : c.bg }]}
                  >
                    <Text style={{ fontSize: 14, color: selected ? c.primary : c.text }}>{l.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {departure.getTime() <= Date.now() && (
            <Text style={{ color: c.error, fontSize: 14 }}>Choose a departure time in the future.</Text>
          )}
          {error ? (
            <Text style={{ color: c.error, fontSize: 14 }} accessibilityLiveRegion="polite">{error}</Text>
          ) : null}

          <Pressable
            onPress={publish}
            disabled={!canPublish}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPublish, busy: publishing }}
            style={[styles.primaryBtn, { backgroundColor: canPublish ? c.primary : c.border, marginTop: 0 }]}
          >
            {publishing ? (
              <ActivityIndicator color={c.textOnPrimary} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: canPublish ? c.textOnPrimary : c.textSec }]}>Publish ride</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <RideDatePicker visible={showDate} selectedDate={date} onSelect={setDate} onClose={() => setShowDate(false)} />
      <ClockTimePicker
        visible={showTime}
        initialTime={time}
        onConfirm={t => { setTime(t); setShowTime(false); }}
        onDismiss={() => setShowTime(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8 },
  header: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: Typography.extrabold },
  body: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  label: { fontSize: 13, fontWeight: Typography.semibold, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, fontSize: 15 },
  suggestions: { borderWidth: 1, borderRadius: Radius.sm, marginTop: 4 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: Spacing.md },
  pickerBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
  },
  seatBtn: { width: 48, height: 48, borderRadius: Radius.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: Radius.sm, borderWidth: 1.5, justifyContent: 'center' },
  primaryBtn: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
    alignSelf: 'stretch',
  },
  primaryBtnText: { fontSize: 16, fontWeight: Typography.bold },
  textBtn: { minHeight: 44, justifyContent: 'center' },
  doneBadge: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  doneTitle: { fontSize: 22, fontWeight: Typography.bold, textAlign: 'center' },
  doneBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
