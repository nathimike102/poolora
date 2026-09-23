/**
 * screens/rider/SearchScreen.tsx
 *
 * Where the rider sets pickup and drop. Pickup starts at the device location;
 * choosing a drop from the suggestions or recent places searches straight
 * away, the way riders expect from ride-hailing apps. Departure time defaults
 * to "now" and can be moved to later, and the seat count sits in the header.
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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { Icon, type IconName } from '../../components/Icon';
import { ClockTimePicker } from '../../components/ClockTimePicker';
import { RideDatePicker } from '../../components/RideDatePicker';
import { MAPS_ENABLED } from '../../config/maps';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { rideService } from '../../services';
import { fetchPlaceSuggestions, geocodePlace, type PlaceSuggestion } from '../../services/placesService';
import {
  getPlaceHistory,
  rememberPlace,
  toggleFavouritePlace,
  type HistoryPlace,
} from '../../services/placeHistoryService';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Search'>;
type SearchRoute = RouteProp<RootStackParamList, 'Search'>;

const SUGGESTION_DEBOUNCE_MS = 300;
const MAX_SEATS = 4;
/** "Now" searches rides leaving within the next four hours (backend window is ±2 h). */
const NOW_WINDOW_CENTRE_MINS = 120;

/** A pickup or drop: the text shown, plus coordinates once known. */
interface Stop {
  name: string;
  subtitle: string;
  lat?: number;
  lng?: number;
}

const EMPTY_STOP: Stop = { name: '', subtitle: '' };
/** Cursor at the start, so a long address shows its first words */
const START = { start: 0, end: 0 };

function stopText(s: Stop): string {
  return s.subtitle ? `${s.name}, ${s.subtitle}` : s.name;
}

/** Coordinates for a stop, looking up typed addresses. */
async function resolve(stop: Stop): Promise<Stop & { lat: number; lng: number }> {
  if (stop.lat !== undefined && stop.lng !== undefined) return { ...stop, lat: stop.lat, lng: stop.lng };
  const g = await geocodePlace(stopText(stop));
  return { ...stop, lat: g.lat, lng: g.lng };
}

function formatWhen(when: Date | null): string {
  if (!when) return 'Now';
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = when.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (when.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (when.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

export function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<SearchRoute>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const { place: here, status: hereStatus } = useCurrentPlace();

  const [pickup, setPickup] = useState<Stop>(EMPTY_STOP);
  /** True while pickup is the device location and hasn't been edited */
  const [pickupIsHere, setPickupIsHere] = useState(true);
  const [drop, setDrop] = useState<Stop>(EMPTY_STOP);
  const [active, setActive] = useState<'pickup' | 'drop'>('drop');
  /** The field with the cursor; the other shows the start of its address, not the end */
  const [focused, setFocused] = useState<'pickup' | 'drop' | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestState, setSuggestState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [history, setHistory] = useState<HistoryPlace[]>([]);
  const [seats, setSeats] = useState(1);
  const [showSeats, setShowSeats] = useState(false);
  const [when, setWhen] = useState<Date | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const pickedDate = useRef<Date | null>(null);
  const [searching, setSearching] = useState(false);
  const [autoSearch, setAutoSearch] = useState(false);

  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestRequest = useRef(0);
  const dropInput = useRef<TextInput>(null);
  const pickupInput = useRef<TextInput>(null);

  useEffect(() => {
    getPlaceHistory().then(setHistory).catch(() => {});
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, []);

  // Pickup follows the device location until the rider types their own
  useEffect(() => {
    if (!pickupIsHere) return;
    if (hereStatus === 'ready' && here) {
      setPickup({ name: here.address ?? 'Current location', subtitle: '', lat: here.lat, lng: here.lng });
    } else {
      setPickup(EMPTY_STOP);
    }
  }, [here, hereStatus, pickupIsHere]);

  // Arrivals from home, saved routes and the map picker
  useEffect(() => {
    const p = route.params;
    if (!p) return;
    if (p.schedule) setShowDate(true);
    if (p.from) {
      setPickupIsHere(false);
      setPickup({ name: p.from, subtitle: '' });
    }
    if (p.to) setDrop({ name: p.to, subtitle: '' });
    if (p.drop) setDrop({ name: p.drop.name, subtitle: p.drop.subtitle, lat: p.drop.lat, lng: p.drop.lng });
    if (p.pickedLocation) {
      if (p.pickedField === 'from') {
        setPickupIsHere(false);
        setPickup({ name: p.pickedLocation, subtitle: '' });
      } else {
        setDrop({ name: p.pickedLocation, subtitle: '' });
      }
    }
    if (p.to || p.drop || (p.pickedLocation && p.pickedField !== 'from')) setAutoSearch(true);
    // Consumed: clear them so a later map pick doesn't re-apply these over the rider's edits
    if (p.from || p.to || p.drop || p.pickedLocation || p.schedule) {
      navigation.setParams({
        from: undefined,
        to: undefined,
        drop: undefined,
        pickedLocation: undefined,
        pickedField: undefined,
        schedule: undefined,
      });
    }
  }, [route.params, navigation]);

  // Focus the drop field on arrival, unless a search is about to run
  const arrival = useRef(route.params).current;
  useEffect(() => {
    if (arrival?.to || arrival?.drop || arrival?.schedule) return;
    const t = setTimeout(() => dropInput.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [arrival]);

  const requestSuggestions = (text: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setSuggestState('idle');
      return;
    }
    setSuggestState('loading');
    suggestTimer.current = setTimeout(async () => {
      const requestId = ++suggestRequest.current;
      try {
        const results = await fetchPlaceSuggestions(text);
        if (requestId !== suggestRequest.current) return;
        setSuggestions(results);
        setSuggestState('idle');
      } catch {
        if (requestId !== suggestRequest.current) return;
        setSuggestions([]);
        setSuggestState('error');
      }
    }, SUGGESTION_DEBOUNCE_MS);
  };

  const onChangePickup = (text: string) => {
    setPickupIsHere(false);
    setPickup({ name: text, subtitle: '' });
    setQuery(text);
    requestSuggestions(text);
  };

  const onChangeDrop = (text: string) => {
    setDrop({ name: text, subtitle: '' });
    setQuery(text);
    requestSuggestions(text);
  };

  const focusField = (field: 'pickup' | 'drop') => {
    setActive(field);
    const text = field === 'pickup' ? (pickupIsHere ? '' : stopText(pickup)) : stopText(drop);
    setQuery(text);
    requestSuggestions(text);
  };

  /** Fill the active field; a completed drop starts the search. */
  const choose = (stop: Stop) => {
    setSuggestions([]);
    setQuery('');
    if (active === 'pickup') {
      setPickupIsHere(false);
      setPickup(stop);
      if (drop.name.trim().length > 2) setAutoSearch(true);
      else dropInput.current?.focus();
      return;
    }
    setDrop(stop);
    setAutoSearch(true);
  };

  const useCurrentLocation = () => {
    setPickupIsHere(true);
    setSuggestions([]);
    setQuery('');
    dropInput.current?.focus();
  };

  const pickupReady = pickupIsHere ? hereStatus === 'ready' : pickup.name.trim().length > 2;
  const canSearch = pickupReady && drop.name.trim().length > 2;

  const runSearch = useCallback(async () => {
    if (!canSearch || searching) return;
    if (when && when.getTime() < Date.now()) {
      Alert.alert('Pick a later time', 'That time has already passed. Choose a time from now on, or leave now.');
      return;
    }
    setSearching(true);
    try {
      const [from, to] = await Promise.all([resolve(pickup), resolve(drop)]);
      const departure = when ?? new Date(Date.now() + NOW_WINDOW_CENTRE_MINS * 60 * 1000);
      const results = await rideService.searchRides({
        pickupLat: from.lat,
        pickupLng: from.lng,
        dropoffLat: to.lat,
        dropoffLng: to.lng,
        departureTime: departure.toISOString(),
      });
      rememberPlace({ name: to.name, subtitle: to.subtitle, lat: to.lat, lng: to.lng }).catch(() => {});
      logger.info('Search successful', { results: results.data.items?.length || 0 });
      navigation.navigate('RideResults', {
        rides: results,
        route: {
          from: stopText(from),
          to: stopText(to),
          seats,
          pickup: { lat: from.lat, lng: from.lng },
          dropoff: { lat: to.lat, lng: to.lng },
          when: when ? when.toISOString() : undefined,
        },
        category: route.params?.category,
      });
    } catch (error) {
      logger.error('Search failed', { error });
      Alert.alert("Couldn't search rides", errorHandler.process(error).message);
    } finally {
      setSearching(false);
    }
  }, [canSearch, searching, when, pickup, drop, seats, navigation, route.params?.category]);

  useEffect(() => {
    if (autoSearch && canSearch && !searching) {
      setAutoSearch(false);
      runSearch();
    }
  }, [autoSearch, canSearch, searching, runSearch]);

  const toggleFavourite = async (p: HistoryPlace) => setHistory(await toggleFavouritePlace(p));

  const showingSuggestions = query.trim().length >= 2;

  return (
    <View style={[styles.root, { backgroundColor: c.surface, paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} style={styles.backBtn}>
            <Icon name="arrow-left" size={26} color={c.text} />
          </Pressable>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
            {active === 'pickup' ? 'Pickup' : 'Drop'}
          </Text>
          <Pressable
            onPress={() => setShowSeats(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${seats} ${seats === 1 ? 'seat' : 'seats'}. Change number of seats`}
            accessibilityState={{ expanded: showSeats }}
            style={[styles.headerPill, { borderColor: c.border }]}
          >
            <Icon name="account-outline" size={18} color={c.text} />
            <Text style={[styles.headerPillText, { color: c.text }]}>{seats} {seats === 1 ? 'seat' : 'seats'}</Text>
            <Icon name={showSeats ? 'chevron-up' : 'chevron-down'} size={18} color={c.text} />
          </Pressable>
        </View>

        {showSeats && (
          <View style={styles.seatRow} accessibilityRole="radiogroup">
            {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map(n => {
              const selected = n === seats;
              return (
                <Pressable
                  key={n}
                  onPress={() => { setSeats(n); setShowSeats(false); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${n} ${n === 1 ? 'seat' : 'seats'}`}
                  style={[styles.seatChip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primaryLight : c.surface }]}
                >
                  <Text style={[styles.seatChipText, { color: selected ? c.primary : c.text }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Pickup / drop card ──────────────────────────────── */}
        <View style={[styles.routeCard, { backgroundColor: c.surfaceVariant, borderColor: c.border }]}>
          <View style={styles.dots}>
            <View style={[styles.dotOuter, { backgroundColor: c.successLight }]}>
              <View style={[styles.dotInner, { backgroundColor: c.success }]} />
            </View>
            <View style={[styles.dotLine, { borderColor: c.textSec }]} />
            <View style={[styles.dotOuter, { backgroundColor: c.errorLight }]}>
              <View style={[styles.dotInner, { backgroundColor: c.error }]} />
            </View>
          </View>
          <View style={styles.flex1}>
            <TextInput
              ref={pickupInput}
              value={pickupIsHere && active !== 'pickup' ? pickup.name || (hereStatus === 'loading' ? 'Finding your location…' : '') : stopText(pickup)}
              onChangeText={onChangePickup}
              onFocus={() => { setFocused('pickup'); focusField('pickup'); }}
              onBlur={() => setFocused(null)}
              selection={focused === 'pickup' ? undefined : START}
              placeholder={pickupIsHere ? 'Current location' : 'Pickup location'}
              placeholderTextColor={c.textSec}
              accessibilityLabel="Pickup location"
              selectTextOnFocus
              style={[styles.input, { color: c.text }]}
              numberOfLines={1}
            />
            <View style={[styles.inputDivider, { backgroundColor: c.border }]} />
            <TextInput
              ref={dropInput}
              value={stopText(drop)}
              onChangeText={onChangeDrop}
              onFocus={() => { setFocused('drop'); focusField('drop'); }}
              onBlur={() => setFocused(null)}
              selection={focused === 'drop' ? undefined : START}
              placeholder="Where to?"
              placeholderTextColor={c.textSec}
              accessibilityLabel="Drop location"
              returnKeyType="search"
              onSubmitEditing={runSearch}
              style={[styles.input, styles.inputDrop, { color: c.text }]}
              numberOfLines={1}
            />
          </View>
        </View>

        {/* ── Map and time chips ──────────────────────────────── */}
        <View style={styles.chipRow}>
          {MAPS_ENABLED && (
            <Pressable
              onPress={() => navigation.navigate('MapPicker', { field: active === 'pickup' ? 'from' : 'to' })}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${active === 'pickup' ? 'pickup' : 'drop'} on the map`}
              style={[styles.chip, { borderColor: c.border }]}
            >
              <Icon name="map-marker-outline" size={20} color={c.text} />
              <Text style={[styles.chipText, { color: c.text }]}>Select on map</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowDate(true)}
            accessibilityRole="button"
            accessibilityLabel={`Leaving ${formatWhen(when)}. Change departure time`}
            style={[styles.chip, { borderColor: when ? c.primary : c.border, backgroundColor: when ? c.primaryLight : c.surface }]}
          >
            <Icon name="clock-outline" size={20} color={when ? c.primary : c.text} />
            <Text style={[styles.chipText, { color: when ? c.primary : c.text }]}>{formatWhen(when)}</Text>
            <Icon name="chevron-down" size={18} color={when ? c.primary : c.text} />
          </Pressable>
          {when && (
            <Pressable
              onPress={() => setWhen(null)}
              accessibilityRole="button"
              accessibilityLabel="Leave now instead"
              hitSlop={8}
              style={[styles.chip, { borderColor: c.border }]}
            >
              <Text style={[styles.chipText, { color: c.text }]}>Now</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.rule, { backgroundColor: c.border }]} />

        {/* ── Suggestions, or recent places ───────────────────── */}
        <ScrollView style={styles.flex1} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.listContent}>
          {active === 'pickup' && !pickupIsHere && (
            <Row
              icon="crosshairs-gps"
              title="Use current location"
              subtitle={hereStatus === 'denied' ? 'Location permission is off' : here?.address ?? undefined}
              onPress={useCurrentLocation}
            />
          )}

          {showingSuggestions ? (
            suggestState === 'error' ? (
              <View style={styles.notice} accessibilityLiveRegion="polite">
                <Icon name="wifi-off" size={20} color={c.textSec} />
                <Text style={[styles.noticeText, { color: c.textSec }]}>
                  Suggestions couldn't be loaded. Check your connection, or type the full address and tap search.
                </Text>
              </View>
            ) : suggestions.length === 0 ? (
              suggestState === 'loading' ? (
                <ActivityIndicator style={styles.loader} color={c.primary} accessibilityLabel="Loading suggestions" />
              ) : (
                <Text style={[styles.noticeText, styles.notice, { color: c.textSec }]}>
                  No matching places. Try a nearby landmark or area name.
                </Text>
              )
            ) : (
              suggestions.map((s, i) => (
                <Row
                  key={s.placeId}
                  icon="map-marker-outline"
                  title={s.name}
                  subtitle={s.subtitle}
                  onPress={() => choose({ name: s.name, subtitle: s.subtitle })}
                  divider={i < suggestions.length - 1}
                />
              ))
            )
          ) : (
            history.map((p, i) => (
              <Row
                key={`${p.name}|${p.subtitle}`}
                icon={p.favourite ? 'star-outline' : 'history'}
                title={p.name}
                subtitle={p.subtitle}
                onPress={() => choose({ name: p.name, subtitle: p.subtitle, lat: p.lat, lng: p.lng })}
                divider={i < history.length - 1}
                favourite={p.favourite}
                onToggleFavourite={() => toggleFavourite(p)}
              />
            ))
          )}
        </ScrollView>

        {/* ── Search button, for typed addresses ──────────────── */}
        {canSearch && !showingSuggestions && (
          <View style={[styles.ctaBar, { borderTopColor: c.border, backgroundColor: c.surface }]}>
            <Pressable
              onPress={runSearch}
              disabled={searching}
              accessibilityRole="button"
              accessibilityLabel="Find rides"
              accessibilityState={{ busy: searching }}
              style={[styles.cta, { backgroundColor: c.primary }]}
            >
              <Text style={[styles.ctaText, { color: c.textOnPrimary }]}>Find rides</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {searching && (
        <View style={[styles.overlay, { backgroundColor: c.surface }]} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={[styles.overlayText, { color: c.text }]}>Finding rides going your way…</Text>
        </View>
      )}

      <RideDatePicker
        visible={showDate}
        selectedDate={when}
        onSelect={d => { pickedDate.current = d; }}
        onClose={() => {
          setShowDate(false);
          if (pickedDate.current) setShowTime(true);
        }}
      />
      <ClockTimePicker
        visible={showTime}
        initialTime={
          when
            ? `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`
            : '09:00'
        }
        onConfirm={t => {
          const d = new Date(pickedDate.current ?? new Date());
          const [h, m] = t.split(':').map(Number);
          d.setHours(h, m, 0, 0);
          pickedDate.current = null;
          setWhen(d);
          setShowTime(false);
        }}
        onDismiss={() => {
          pickedDate.current = null;
          setShowTime(false);
        }}
      />
    </View>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({
  icon,
  title,
  subtitle,
  onPress,
  divider,
  favourite,
  onToggleFavourite,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  divider?: boolean;
  favourite?: boolean;
  onToggleFavourite?: () => void;
}) {
  const { c } = useApp();
  return (
    <View style={[styles.row, divider && [styles.dashed, { borderColor: c.border }]]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} style={styles.rowMain}>
        <Icon name={icon} size={22} color={c.textSec} />
        <View style={styles.flex1}>
          <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.rowSub, { color: c.textSec }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </Pressable>
      {onToggleFavourite && (
        <Pressable
          onPress={onToggleFavourite}
          accessibilityRole="button"
          accessibilityLabel={favourite ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
          hitSlop={10}
          style={styles.heartBtn}
        >
          <Icon name={favourite ? 'heart' : 'heart-outline'} size={24} color={favourite ? c.error : c.textSec} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: Typography['6xl'], fontWeight: Typography.extrabold },
  headerPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: Spacing.lg, borderRadius: Radius.full, borderWidth: 1 },
  headerPillText: { fontSize: Typography.lg, fontWeight: Typography.semibold },

  seatRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  seatChip: { width: 48, height: 44, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  seatChipText: { fontSize: Typography.xl, fontWeight: Typography.bold },

  routeCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    gap: Spacing.md,
  },
  dots: { alignItems: 'center', paddingVertical: 16 },
  dotOuter: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 10, height: 10, borderRadius: 5 },
  dotLine: { flex: 1, width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', marginVertical: 4 },
  input: { fontSize: Typography['2xl'], minHeight: 50, paddingVertical: 0 },
  inputDrop: { fontWeight: Typography.semibold },
  inputDivider: { height: 1 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: Spacing.lg, borderRadius: Radius.full, borderWidth: 1 },
  chipText: { fontSize: Typography.lg, fontWeight: Typography.semibold },

  rule: { height: 1 },
  listContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 68 },
  dashed: { borderBottomWidth: 1, borderStyle: 'dashed' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.md },
  rowTitle: { fontSize: Typography['2xl'], fontWeight: Typography.semibold },
  rowSub: { fontSize: Typography.md, marginTop: 2 },
  heartBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.xl },
  noticeText: { flex: 1, fontSize: Typography.md, lineHeight: 20 },
  loader: { marginTop: Spacing.xl },

  ctaBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderTopWidth: 1 },
  cta: { minHeight: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  ctaText: { fontSize: Typography.xl, fontWeight: Typography.bold },

  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, opacity: 0.96 },
  overlayText: { fontSize: Typography.xl, fontWeight: Typography.semibold },
});
