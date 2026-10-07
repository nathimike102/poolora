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
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon3D } from '../../components/Icon3D';
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
import { REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

import { tc, tk } from '../../theme/themed';

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
  if (!when) return i18n.t('search.now');
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = when.toLocaleTimeString(REGION.dateLocale, { hour: 'numeric', minute: '2-digit' });
  if (when.toDateString() === today.toDateString()) return i18n.t('home.today', { time });
  if (when.toDateString() === tomorrow.toDateString()) return i18n.t('home.tomorrow', { time });
  return `${when.toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short' })}, ${time}`;
}

export function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<SearchRoute>();
  const { t } = useTranslation();
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
      setPickup({ name: here.address ?? t('home.currentLocation'), subtitle: '', lat: here.lat, lng: here.lng });
    } else {
      setPickup(EMPTY_STOP);
    }
  }, [here, hereStatus, pickupIsHere, t]);

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
        setPickup({ name: p.pickedLocation, subtitle: '', lat: p.pickedLat, lng: p.pickedLng });
      } else {
        setDrop({ name: p.pickedLocation, subtitle: '', lat: p.pickedLat, lng: p.pickedLng });
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
        pickedLat: undefined,
        pickedLng: undefined,
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
        const results = await fetchPlaceSuggestions(text, here ? { lat: here.lat, lng: here.lng } : undefined);
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

  const pickupValue = pickupIsHere && active !== 'pickup' ? pickup.name || (hereStatus === 'loading' ? t('home.findingLocation') : '') : stopText(pickup);
  const dropValue = stopText(drop);
  // An unfocused Android field shows the end of a long address and no
  // selection brings it back, so it shows the start, cut short with "…", in
  // text laid over it. Touches pass through to the field underneath.
  const showPickupPreview = focused !== 'pickup' && pickupValue.length > 0;
  const showDropPreview = focused !== 'drop' && dropValue.length > 0;
  const canSearch = pickupReady && drop.name.trim().length > 2;

  const runSearch = useCallback(async () => {
    if (!canSearch || searching) return;
    if (when && when.getTime() < Date.now()) {
      Alert.alert(t('search.laterTitle'), t('search.laterBody'));
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
      Alert.alert(t('search.failed'), errorHandler.process(error).message);
    } finally {
      setSearching(false);
    }
  }, [canSearch, searching, when, pickup, drop, seats, navigation, route.params?.category, t]);

  useEffect(() => {
    if (autoSearch && canSearch && !searching) {
      setAutoSearch(false);
      runSearch();
    }
  }, [autoSearch, canSearch, searching, runSearch]);

  const toggleFavourite = async (p: HistoryPlace) => setHistory(await toggleFavouritePlace(p));

  const showingSuggestions = query.trim().length >= 2;

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('search.goBack')} hitSlop={8} style={styles.backBtn}>
            <Icon name="arrow-left" size={26} color={tk.text} />
          </Pressable>
          <Text style={[styles.title, tc.color_text]} accessibilityRole="header">
            {active === 'pickup' ? t('search.pickup') : t('search.drop')}
          </Text>
          <Pressable
            onPress={() => setShowSeats(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('search.seatsLabel', { seats: seats === 1 ? t('search.seatOne') : t('search.seatMany', { count: seats }) })}
            accessibilityState={{ expanded: showSeats }}
            style={[styles.headerPill, tc.borderColor_border]}
          >
            <Icon name="account-outline" size={18} color={tk.text} />
            <Text style={[styles.headerPillText, tc.color_text]}>{seats === 1 ? t('search.seatOne') : t('search.seatMany', { count: seats })}</Text>
            <Icon name={showSeats ? 'chevron-up' : 'chevron-down'} size={18} color={tk.text} />
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
                  accessibilityLabel={n === 1 ? t('search.seatOne') : t('search.seatMany', { count: n })}
                  style={[
                    styles.seatChip,
                    selected ? tc.borderColor_primary : tc.borderColor_border,
                    selected ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                  ]}
                >
                  <Text style={[styles.seatChipText, selected ? tc.color_primary : tc.color_text]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Pickup / drop card ──────────────────────────────── */}
        <View style={[styles.routeCard, tc.backgroundColor_surfaceVariant, tc.borderColor_border]}>
          <View style={styles.dots}>
            <View style={[styles.dotOuter, tc.backgroundColor_successLight]}>
              <View style={[styles.dotInner, tc.backgroundColor_success]} />
            </View>
            <View style={[styles.dotLine, tc.borderColor_textSec]} />
            <View style={[styles.dotOuter, tc.backgroundColor_errorLight]}>
              <View style={[styles.dotInner, tc.backgroundColor_error]} />
            </View>
          </View>
          <View style={styles.flex1}>
            <View>
              <TextInput
                ref={pickupInput}
                value={pickupValue}
                onChangeText={onChangePickup}
                onFocus={() => { setFocused('pickup'); focusField('pickup'); }}
                onBlur={() => setFocused(null)}
                placeholder={pickupIsHere ? t('home.currentLocation') : t('search.pickupPlaceholder')}
                placeholderTextColor={tk.textSec}
                accessibilityLabel={t('search.pickupPlaceholder')}
                selectTextOnFocus
                style={[styles.input, { opacity: showPickupPreview ? 0 : 1 }, tc.color_text]}
                numberOfLines={1}
              />
              {showPickupPreview ? (
                <View pointerEvents="none" style={styles.preview}>
                  <Text style={[styles.input, styles.previewText, tc.color_text]} numberOfLines={1}>{pickupValue}</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.inputDivider, tc.backgroundColor_border]} />
            <View>
              <TextInput
                ref={dropInput}
                value={dropValue}
                onChangeText={onChangeDrop}
                onFocus={() => { setFocused('drop'); focusField('drop'); }}
                onBlur={() => setFocused(null)}
                placeholder={t('search.dropPlaceholder')}
                placeholderTextColor={tk.textSec}
                accessibilityLabel={t('search.dropLabel')}
                returnKeyType="search"
                onSubmitEditing={runSearch}
                style={[styles.input, styles.inputDrop, { opacity: showDropPreview ? 0 : 1 }, tc.color_text]}
                numberOfLines={1}
              />
              {showDropPreview ? (
                <View pointerEvents="none" style={styles.preview}>
                  <Text style={[styles.input, styles.inputDrop, styles.previewText, tc.color_text]} numberOfLines={1}>{dropValue}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Map and time chips ──────────────────────────────── */}
        <View style={styles.chipRow}>
          {MAPS_ENABLED && (
            <Pressable
              onPress={() => navigation.navigate('MapPicker', { field: active === 'pickup' ? 'from' : 'to' })}
              accessibilityRole="button"
              accessibilityLabel={active === 'pickup' ? t('search.mapPickup') : t('search.mapDrop')}
              style={[styles.chip, tc.borderColor_border]}
            >
              <Icon3D name="worldMap" size={22} />
              <Text style={[styles.chipText, tc.color_text]}>{t('search.selectOnMap')}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowDate(true)}
            accessibilityRole="button"
            accessibilityLabel={t('search.leavingLabel', { when: formatWhen(when) })}
            style={[
              styles.chip,
              when ? tc.borderColor_primary : tc.borderColor_border,
              when ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
            ]}
          >
            <Icon name="clock-outline" size={20} color={when ? tk.primary : tk.text} />
            <Text style={[styles.chipText, when ? tc.color_primary : tc.color_text]}>{formatWhen(when)}</Text>
            <Icon name="chevron-down" size={18} color={when ? tk.primary : tk.text} />
          </Pressable>
          {when && (
            <Pressable
              onPress={() => setWhen(null)}
              accessibilityRole="button"
              accessibilityLabel={t('search.leaveNow')}
              hitSlop={8}
              style={[styles.chip, tc.borderColor_border]}
            >
              <Text style={[styles.chipText, tc.color_text]}>{t('search.now')}</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.rule, tc.backgroundColor_border]} />

        {/* ── Suggestions, or recent places ───────────────────── */}
        <ScrollView style={styles.flex1} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.listContent}>
          {active === 'pickup' && !pickupIsHere && (
            <Row
              icon="crosshairs-gps"
              title={t('search.useCurrent')}
              subtitle={hereStatus === 'denied' ? t('search.permissionOff') : here?.address ?? undefined}
              onPress={useCurrentLocation}
            />
          )}

          {showingSuggestions ? (
            suggestState === 'error' ? (
              <View style={styles.notice} accessibilityLiveRegion="polite">
                <Icon name="wifi-off" size={20} color={tk.textSec} />
                <Text style={[styles.noticeText, tc.color_textSec]}>
                  {t('search.suggestFailed')}
                </Text>
              </View>
            ) : suggestions.length === 0 ? (
              suggestState === 'loading' ? (
                <ActivityIndicator style={styles.loader} color={tk.primary} accessibilityLabel={t('search.loadingSuggestions')} />
              ) : (
                <Text style={[styles.noticeText, styles.notice, tc.color_textSec]}>
                  {t('search.noMatches')}
                </Text>
              )
            ) : (
              suggestions.map((s, i) => (
                <Row
                  key={s.placeId}
                  icon={s.hub === 'bus_terminus' ? 'bus' : s.hub === 'kombi_rank' ? 'van-passenger' : 'map-marker-outline'}
                  title={s.name}
                  subtitle={s.subtitle}
                  onPress={() => choose({ name: s.name, subtitle: s.subtitle, ...(s.lat !== undefined && s.lng !== undefined ? { lat: s.lat, lng: s.lng } : {}) })}
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
          <View style={[styles.ctaBar, tc.borderTopColor_border, tc.backgroundColor_surface]}>
            <Pressable
              onPress={runSearch}
              disabled={searching}
              accessibilityRole="button"
              accessibilityLabel={t('search.findRides')}
              accessibilityState={{ busy: searching }}
              style={[styles.cta, tc.backgroundColor_primary]}
            >
              <Text style={[styles.ctaText, tc.color_textOnPrimary]}>{t('search.findRides')}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {searching && (
        <View style={[styles.overlay, tc.backgroundColor_surface]} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={tk.primary} />
          <Text style={[styles.overlayText, tc.color_text]}>{t('search.finding')}</Text>
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
  const { t } = useTranslation();
  return (
    <View style={[styles.row, divider && [styles.dashed, tc.borderColor_border]]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} style={styles.rowMain}>
        <Icon name={icon} size={22} color={tk.textSec} />
        <View style={styles.flex1}>
          <Text style={[styles.rowTitle, tc.color_text]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.rowSub, tc.color_textSec]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </Pressable>
      {onToggleFavourite && (
        <Pressable
          onPress={onToggleFavourite}
          accessibilityRole="button"
          accessibilityLabel={favourite ? t('home.unfavourite', { name: title }) : t('home.favourite', { name: title })}
          hitSlop={10}
          style={styles.heartBtn}
        >
          <Icon name={favourite ? 'heart' : 'heart-outline'} size={24} color={favourite ? tk.heart : tk.textSec} />
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
  preview: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center' },
  previewText: { minHeight: 0 },

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
