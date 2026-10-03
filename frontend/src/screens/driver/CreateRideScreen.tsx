/**
 * screens/driver/CreateRideScreen.tsx
 *
 * Publishes a ride offer (UC-D02). Places come from backend place search, the
 * vehicle must be one of the driver's verified vehicles, and the ride is only
 * shown as published after the API accepts it. The driver can add up to three
 * stops and a return trip, and picks a seat price within the range around the
 * suggested one.
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
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { Icon } from '../../components/Icon';
import { RideDatePicker } from '../../components/RideDatePicker';
import { ClockTimePicker } from '../../components/ClockTimePicker';
import { choosePlace, fetchPlaceSuggestions, geocodePlace, type PlaceSuggestion } from '../../services/placesService';
import { rideService } from '../../services/rideService';
import { userService } from '../../services/userService';
import { errorHandler } from '../../utils/errorHandler';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import { Radius, Spacing, Typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import type { CreateRideResult, PriceSuggestion, User, Vehicle } from '../../types/api';
import { money, moneyInput, REGION } from '../../utils/region';
import { maxSeatsFor } from '../../utils/vehicles';
import { identityService } from '../../services/identityService';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;
/** 'from', 'to', or the index of a stop */
type Field = 'from' | 'to' | number;
type Luggage = 'none' | 'small' | 'medium' | 'large';

const MAX_STOPS = 3;
/** The backend refuses rides that leave sooner than this */
const MIN_ADVANCE_HOURS = 2;
const SUGGESTION_DEBOUNCE_MS = 300;
const PRICE_DEBOUNCE_MS = 700;
/** Labels are in the catalogue under createRide.luggage */
const LUGGAGE: Luggage[] = ['none', 'small', 'medium', 'large'];

function formatDate(d: Date): string {
  return d.toLocaleDateString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' });
}

function atTime(day: Date, t: string): Date {
  const d = new Date(day);
  const [h, m] = t.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** "08:30", the 24-hour clock the rest of the app shows */
function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function CreateRideScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
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
  // Suggestions near the driver come first
  const { place: here } = useCurrentPlace();

  const [stops, setStops] = useState<string[]>([]);

  const [date, setDate] = useState<Date>(() => new Date());
  const [time, setTime] = useState('08:30');
  // Which trip the date and time pickers are open for
  const [showDate, setShowDate] = useState<'out' | 'return' | null>(null);
  const [showTime, setShowTime] = useState<'out' | 'return' | null>(null);
  const [withReturn, setWithReturn] = useState(false);
  const [returnDate, setReturnDate] = useState<Date>(() => new Date());
  const [returnTime, setReturnTime] = useState('18:00');
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [womenOnly, setWomenOnly] = useState(false);

  // Only a woman whose identity check passed can post a women-only ride; say so before posting fails
  const chooseWomenOnly = async (on: boolean) => {
    if (!on) {
      setWomenOnly(false);
      return;
    }
    const identity = await identityService.status().catch(() => null);
    if (identity?.status === 'verified' && identity.gender === 'female') {
      setWomenOnly(true);
      return;
    }
    Alert.alert(
      t('createRide.womenOnlyRides'),
      identity?.status === 'pending'
        ? t('createRide.youCanOfferWomenOnly') : t('createRide.onlyWomenWhoHaveVerified'),
      identity?.status === 'pending'
        ? [{ text: t('createRide.ok') }]
        : [{ text: t('createRide.notNow'), style: 'cancel' }, { text: t('createRide.verifyMyIdentity'), onPress: () => navigation.navigate('IdentityCheck') }],
    );
  };
  // A driver in a company programme can keep a ride to colleagues (UC-C02)
  const [company, setCompany] = useState<string | null>(null);
  const [colleaguesOnly, setColleaguesOnly] = useState(false);
  useEffect(() => {
    userService.getWork()
      .then(w => setCompany(w.work?.organisation.active ? w.work.organisation.name : null))
      .catch(() => setCompany(null));
  }, []);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [luggage, setLuggage] = useState<Luggage>('medium');

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState<CreateRideResult | null>(null);

  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const priceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceRequest = useRef(0);
  // Addresses already looked up, so the suggestion and publishing share them
  const geocoded = useRef(new Map<string, Promise<{ lat: number; lng: number; address: string }>>());

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
    if (priceTimer.current) clearTimeout(priceTimer.current);
  }, []);

  const locate = useCallback((address: string) => {
    const key = address.trim();
    let found = geocoded.current.get(key);
    if (!found) {
      found = geocodePlace(key).then(p => ({ lat: p.lat, lng: p.lng, address: p.formattedAddress }));
      found.catch(() => geocoded.current.delete(key));
      geocoded.current.set(key, found);
    }
    return found;
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
        const results = await fetchPlaceSuggestions(text, here ? { lat: here.lat, lng: here.lng } : undefined);
        if (id === suggestRequest.current) setSuggestions(results);
      } catch {
        if (id === suggestRequest.current) setSuggestions([]);
      }
    }, SUGGESTION_DEBOUNCE_MS);
  };

  const setField = (field: Field, text: string) => {
    if (field === 'from') setFrom(text);
    else if (field === 'to') setTo(text);
    else setStops(list => list.map((s, i) => (i === field ? text : s)));
  };

  const onChange = (field: Field, text: string) => {
    setActiveField(field);
    setField(field, text);
    requestSuggestions(text);
  };

  const pick = (place: PlaceSuggestion) => {
    if (activeField !== null) setField(activeField, choosePlace(place));
    setSuggestions([]);
    setActiveField(null);
  };

  const removeStop = (index: number) => {
    setStops(list => list.filter((_, i) => i !== index));
    setActiveField(null);
    setSuggestions([]);
  };

  const departure = atTime(date, time);
  const returnDeparture = atTime(returnDate, returnTime);
  const earliest = Date.now() + MIN_ADVANCE_HOURS * 3_600_000;
  const filledStops = stops.map(s => s.trim()).filter(s => s.length > 2);

  const priceNumber = Number(price);
  const vehicles: Vehicle[] = profile?.vehicles ?? [];
  const vehicleType = vehicles.find(v => v._id === vehicleId)?.vehicleType;
  const maxSeats = maxSeatsFor(vehicleType);
  // A bike offers one seat, a tuk-tuk three; switching vehicle trims the choice
  useEffect(() => setSeats(n => Math.min(n, maxSeats)), [maxSeats]);
  const kycApproved = profile?.kyc?.status === 'approved';
  const routeReady = from.trim().length > 2 && to.trim().length > 2;
  const priceInRange = !suggestion || (priceNumber >= suggestion.min && priceNumber <= suggestion.max);
  const returnOk = !withReturn || returnDeparture.getTime() > departure.getTime();
  const canPublish =
    kycApproved &&
    routeReady &&
    Boolean(vehicleId) &&
    price !== '' &&
    Number.isFinite(priceNumber) &&
    priceNumber > 0 &&
    priceInRange &&
    departure.getTime() >= earliest &&
    returnOk &&
    !publishing;

  // The suggested price for the route, refreshed when the route, time or vehicle changes
  const departureIso = departure.toISOString();
  const stopsKey = filledStops.join('|');
  useEffect(() => {
    if (priceTimer.current) clearTimeout(priceTimer.current);
    if (!routeReady || activeField !== null) return;
    const id = ++priceRequest.current;
    priceTimer.current = setTimeout(async () => {
      setSuggesting(true);
      try {
        const [pickup, dropoff, ...via] = await Promise.all([locate(from), locate(to), ...filledStops.map(locate)]);
        const next = await rideService.getPriceSuggestion({ pickup, dropoff, departureTime: departureIso, vehicleType, stops: via });
        if (id !== priceRequest.current) return;
        setSuggestion(next);
        setPrice(current => (current === '' ? String(next.suggested) : current));
      } catch {
        if (id === priceRequest.current) setSuggestion(null);
      } finally {
        if (id === priceRequest.current) setSuggesting(false);
      }
    }, PRICE_DEBOUNCE_MS);
    // filledStops is covered by stopsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, stopsKey, departureIso, vehicleType, routeReady, activeField, locate]);

  const publish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setError('');
    try {
      const [pickup, dropoff, ...waypoints] = await Promise.all([locate(from), locate(to), ...filledStops.map(locate)]);
      const result = await rideService.createRide({
        vehicleId,
        pickup,
        dropoff,
        waypoints: waypoints.length ? waypoints : undefined,
        departureTime: departure.toISOString(),
        returnDepartureTime: withReturn ? returnDeparture.toISOString() : undefined,
        totalSeats: seats,
        pricePerSeat: Math.round(priceNumber * 100) / 100,
        preferences: { womenOnly, colleaguesOnly: Boolean(company) && colleaguesOnly, smokingAllowed, petsAllowed, luggageSize: luggage },
      });
      setPublished(result);
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
    setStops([]);
    setWithReturn(false);
    setPrice('');
    setSuggestion(null);
  };

  // ── Published ────────────────────────────────────────────────────
  if (published) {
    const { ride, returnRide, returnError } = published;
    const when = (iso: string) =>
      `${formatDate(new Date(iso))} at ${new Date(iso).toLocaleTimeString(REGION.dateLocale, { hour: '2-digit', minute: '2-digit' })}`;
    return (
      <View style={[styles.centered, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={[styles.doneBadge, { backgroundColor: c.success }]}>
          <Icon name="check" size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.doneTitle, { color: c.text }]} accessibilityLiveRegion="polite">
          {returnRide ? t('createRide.bothRidesPublished') : t('createRide.ridePublished')}
        </Text>
        <Text style={[styles.doneBody, { color: c.textSec }]}>
          {t('createRide.doneRoute', { from: ride.pickupLocation.address, to: ride.dropoffLocation.address })}
        </Text>
        <Text style={[styles.doneBody, { color: c.textSec }]}>
          {t('createRide.doneDetails', { when: when(ride.scheduledDeparture), seats: ride.seats, price: money(ride.pricePerSeat) })}
        </Text>
        {returnRide ? (
          <Text style={[styles.doneBody, { color: c.textSec }]}>{t('createRide.doneReturn', { when: when(returnRide.scheduledDeparture) })}</Text>
        ) : null}
        {returnError ? (
          <Text style={[styles.doneBody, { color: c.error }]} accessibilityLiveRegion="polite">
            The return trip was not published: {returnError}
          </Text>
        ) : null}
        <Pressable
          onPress={() => navigation.navigate('DriverRideDetails', { rideId: ride._id })}
          accessibilityRole="button"
          style={[styles.primaryBtn, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>{t('createRide.viewRide')}</Text>
        </Pressable>
        <Pressable onPress={reset} accessibilityRole="button" style={styles.textBtn}>
          <Text style={{ fontSize: 15, color: c.primary, fontWeight: '600' }}>{t('createRide.offerAnotherRide')}</Text>
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
          {pending ? t('createRide.verificationInReview') : t('createRide.verifyToOfferRides')}
        </Text>
        <Text style={[styles.doneBody, { color: c.textSec }]}>
          {pending
            ? t('createRide.youCanPublishRidesOnce') : t('createRide.ridersCanOnlyBookDrivers')}
        </Text>
        {!pending && (
          <Pressable
            onPress={() => navigation.navigate('KYC')}
            accessibilityRole="button"
            style={[styles.primaryBtn, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>{t('createRide.startVerification')}</Text>
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
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{t('createRide.offerARide')}</Text>
      </View>

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {profileError && (
            <Text style={{ color: c.error, fontSize: 14 }}>
              {t('createRide.yourDriverProfileCouldNot')}
            </Text>
          )}

          {/* Route, with up to three stops on the way */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textSec }]}>{t('createRide.leavingFrom')}</Text>
            <TextInput
              value={from}
              onChangeText={t => onChange('from', t)}
              onFocus={() => setActiveField('from')}
              placeholder={t('createRide.startingPoint')}
              placeholderTextColor={c.textSec}
              accessibilityLabel={t('createRide.leavingFrom')}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            {renderSuggestions('from')}
            {stops.map((stop, i) => (
              <View key={i}>
                <Text style={[styles.label, { color: c.textSec, marginTop: Spacing.md }]}>{t('createRide.stop', { n: i + 1 })}</Text>
                <View style={styles.stopRow}>
                  <TextInput
                    value={stop}
                    onChangeText={t => onChange(i, t)}
                    onFocus={() => setActiveField(i)}
                    placeholder={t('createRide.aPlaceOnTheWay')}
                    placeholderTextColor={c.textSec}
                    accessibilityLabel={t('createRide.stop', { n: i + 1 })}
                    style={[styles.input, { flex: 1, borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                  />
                  <Pressable
                    onPress={() => removeStop(i)}
                    accessibilityRole="button"
                    accessibilityLabel={t('createRide.removeStop', { n: i + 1 })}
                    style={styles.iconBtn}
                  >
                    <Icon name="close" size={20} color={c.textSec} />
                  </Pressable>
                </View>
                {renderSuggestions(i)}
              </View>
            ))}
            {stops.length < MAX_STOPS && (
              <Pressable
                onPress={() => setStops(list => [...list, ''])}
                accessibilityRole="button"
                style={styles.addStop}
              >
                <Icon name="plus" size={18} color={c.primary} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>{t('createRide.addAStop')}</Text>
              </Pressable>
            )}
            <Text style={[styles.label, { color: c.textSec, marginTop: Spacing.md }]}>{t('createRide.goingTo')}</Text>
            <TextInput
              value={to}
              onChangeText={t => onChange('to', t)}
              onFocus={() => setActiveField('to')}
              placeholder={t('createRide.destination')}
              placeholderTextColor={c.textSec}
              accessibilityLabel={t('createRide.goingTo')}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            {renderSuggestions('to')}
          </View>

          {/* When */}
          <View style={[styles.card, styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Pressable
              onPress={() => setShowDate('out')}
              accessibilityRole="button"
              accessibilityLabel={t('createRide.dateLabel', { date: formatDate(date) })}
              style={[styles.pickerBtn, { borderColor: c.border, backgroundColor: c.bg }]}
            >
              <Icon name="calendar" size={18} color={c.primary} />
              <Text style={{ fontSize: 15, color: c.text }}>{formatDate(date)}</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTime('out')}
              accessibilityRole="button"
              accessibilityLabel={t('createRide.timeLabel', { time: formatTime(time) })}
              style={[styles.pickerBtn, { borderColor: c.border, backgroundColor: c.bg }]}
            >
              <Icon name="clock-outline" size={18} color={c.primary} />
              <Text style={{ fontSize: 15, color: c.text }}>{formatTime(time)}</Text>
            </Pressable>
          </View>

          {/* Return trip: the same ride back, stops reversed */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.switchRow}>
              <Text style={{ fontSize: 15, color: c.text, flex: 1 }}>{t('createRide.alsoOfferTheReturnTrip')}</Text>
              <Switch
                value={withReturn}
                onValueChange={on => {
                  setWithReturn(on);
                  if (on && returnDeparture.getTime() <= departure.getTime()) setReturnDate(new Date(date));
                }}
                accessibilityLabel={t('createRide.alsoOfferTheReturnTrip')}
                trackColor={{ false: c.border, true: c.primary }}
              />
            </View>
            {withReturn && (
              <>
                <View style={styles.row}>
                  <Pressable
                    onPress={() => setShowDate('return')}
                    accessibilityRole="button"
                    accessibilityLabel={t('createRide.returnDateLabel', { date: formatDate(returnDate) })}
                    style={[styles.pickerBtn, { borderColor: c.border, backgroundColor: c.bg }]}
                  >
                    <Icon name="calendar" size={18} color={c.primary} />
                    <Text style={{ fontSize: 15, color: c.text }}>{formatDate(returnDate)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowTime('return')}
                    accessibilityRole="button"
                    accessibilityLabel={t('createRide.returnTimeLabel', { time: formatTime(returnTime) })}
                    style={[styles.pickerBtn, { borderColor: c.border, backgroundColor: c.bg }]}
                  >
                    <Icon name="clock-outline" size={18} color={c.primary} />
                    <Text style={{ fontSize: 15, color: c.text }}>{formatTime(returnTime)}</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 13, color: returnOk ? c.textSec : c.error, marginTop: 6 }}>
                  {returnOk
                    ? t('createRide.returnSummary', { to: to.split(',')[0] || t('createRide.destination'), from: from.split(',')[0] || t('createRide.startLower') })
                    : t('createRide.returnBefore')}
                </Text>
              </>
            )}
          </View>

          {/* Seats and price */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textSec }]}>{t('createRide.seatsToOffer')}</Text>
            <View style={styles.row} accessibilityRole="radiogroup">
              {Array.from({ length: maxSeats }, (_, i) => i + 1).map(n => {
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

            <Text style={[styles.label, { color: c.textSec, marginTop: Spacing.md }]}>{t('createRide.pricePerSeatUs')}</Text>
            {suggestion ? (
              <View style={[styles.suggestBox, { backgroundColor: c.primaryLight }]} accessibilityLiveRegion="polite">
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                  {t('createRide.suggested', { price: money(suggestion.suggested), min: money(suggestion.min), max: money(suggestion.max) })}
                </Text>
                <Text style={{ fontSize: 13, color: c.textSec }}>{suggestion.explanation}</Text>
                {String(suggestion.suggested) !== price && (
                  <Pressable onPress={() => setPrice(String(suggestion.suggested))} accessibilityRole="button" style={styles.textBtn}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>{t('createRide.usePrice', { price: money(suggestion.suggested) })}</Text>
                  </Pressable>
                )}
              </View>
            ) : suggesting ? (
              <Text style={{ fontSize: 13, color: c.textSec, marginBottom: 6 }}>{t('createRide.workingOutAFairPrice')}</Text>
            ) : null}
            <TextInput
              value={price}
              onChangeText={t => setPrice(moneyInput(t))}
              keyboardType="decimal-pad"
              placeholder={t('createRide.forExample250')}
              placeholderTextColor={c.textSec}
              accessibilityLabel={t('createRide.pricePerSeatInUs')}
              maxLength={5}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            {price !== '' && !priceInRange && suggestion ? (
              <Text style={{ fontSize: 13, color: c.error, marginTop: 6 }}>
                {t('createRide.mustBeBetween', { min: money(suggestion.min), max: money(suggestion.max) })}
              </Text>
            ) : price !== '' ? (
              <Text style={{ fontSize: 13, color: c.textSec, marginTop: 6 }}>
                {money((priceNumber * seats))} if every seat is booked, before the platform fee.
              </Text>
            ) : null}
          </View>

          {/* Vehicle */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textSec }]}>{t('createRide.vehicle')}</Text>
            {vehicles.length === 0 ? (
              <Text style={{ fontSize: 14, color: c.textSec }}>
                {t('createRide.noVerifiedVehiclesOnYour')}
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
            <Text style={[styles.label, { color: c.textSec }]}>{t('createRide.rideRules')}</Text>
            {[
              { label: t('createRide.rules.womenOnly'), value: womenOnly, set: chooseWomenOnly },
              ...(company ? [{ label: t('createRide.rules.colleaguesOnly', { company }), value: colleaguesOnly, set: setColleaguesOnly }] : []),
              { label: t('createRide.rules.smoking'), value: smokingAllowed, set: setSmokingAllowed },
              { label: t('createRide.rules.pets'), value: petsAllowed, set: setPetsAllowed },
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
            <Text style={[styles.label, { color: c.textSec, marginTop: Spacing.sm }]}>{t('createRide.luggageSpace')}</Text>
            <View style={styles.row} accessibilityRole="radiogroup">
              {LUGGAGE.map(value => ({ value, label: t(`createRide.luggage.${value}`) })).map(l => {
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

          {departure.getTime() < earliest && (
            <Text style={{ color: c.error, fontSize: 14 }}>
              Rides must be offered at least {MIN_ADVANCE_HOURS} hours before they leave, so riders have time to book.
            </Text>
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
              <Text style={[styles.primaryBtnText, { color: canPublish ? c.textOnPrimary : c.textSec }]}>{t('createRide.publishRide')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <RideDatePicker
        visible={showDate !== null}
        selectedDate={showDate === 'return' ? returnDate : date}
        onSelect={d => (showDate === 'return' ? setReturnDate(d) : setDate(d))}
        onClose={() => setShowDate(null)}
      />
      <ClockTimePicker
        key={showTime ?? 'closed'}
        visible={showTime !== null}
        initialTime={showTime === 'return' ? returnTime : time}
        onConfirm={t => {
          if (showTime === 'return') setReturnTime(t);
          else setTime(t);
          setShowTime(null);
        }}
        onDismiss={() => setShowTime(null)}
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
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addStop: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: Spacing.sm },
  suggestBox: { borderRadius: Radius.sm, padding: Spacing.md, gap: 2, marginBottom: Spacing.sm },
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
