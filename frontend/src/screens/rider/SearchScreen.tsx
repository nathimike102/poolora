/**
 * screens/rider/SearchScreen.tsx
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute, type CompositeNavigationProp, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClockTimePicker } from '../../components/ClockTimePicker';
import { RideDatePicker } from '../../components/RideDatePicker';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList, RiderTabParamList } from '../../navigation/types';
import { rideService } from '../../services';
import { logger } from '../../utils/logger';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RiderTabParamList, 'Search'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type SearchRoute = RouteProp<RiderTabParamList, 'Search'>;

// ─── Mock Data ────────────────────────────────────────────────────────────────

const recentSearches = [
  { from: 'Koramangala 6th Block', to: 'MG Road Metro' },
  { from: 'HSR Layout Sector 1', to: 'Whitefield ITPL' },
  { from: 'Home', to: 'Kempegowda Airport' },
];

const ALL_LOCATIONS = [
  'Koramangala 6th Block', 'Koramangala 4th Block', 'MG Road Metro Station',
  'HSR Layout Sector 1', 'Whitefield ITPL', 'Indiranagar 100 Feet Road',
  'Electronic City Phase 1', 'Kempegowda International Airport',
  'Marathahalli Bridge', 'Hebbal Flyover', 'Jayanagar 4th Block',
  'BTM Layout 2nd Stage', 'Yelahanka New Town', 'Banashankari BDA Complex',
  'Vidhana Soudha',
];
const DEFAULT_SUGGESTIONS = ALL_LOCATIONS.slice(0, 5);

// ─── AnimatedPressable ────────────────────────────────────────────────────────

function AnimatedPressable({
  onPress,
  scaleValue = 0.97,
  style,
  children,
}: {
  onPress: () => void;
  scaleValue?: number;
  style?: any;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [scale, scaleValue]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<SearchRoute>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [time, setTime] = useState('09:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [seats, setSeats] = useState(1);
  const [activeInput, setActiveInput] = useState<'from' | 'to' | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searching, setSearching] = useState(false);
  const canSearch = from.length > 2 && to.length > 2;

  // Apply a location picked from the map picker screen
  useEffect(() => {
    const params = route.params as { pickedLocation?: string; pickedField?: 'from' | 'to' } | undefined;
    if (params?.pickedLocation) {
      if (params.pickedField === 'to') setTo(params.pickedLocation);
      else setFrom(params.pickedLocation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params]);

  const formatSelectedDate = (d: Date | null) => {
    if (!d) return 'Pick a date';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Converts internal 24-h "HH:mm" string to a display-friendly 12-h string.
  const formatTime = (t: string): string => {
    const [hStr, mStr] = t.split(':');
    const h24 = parseInt(hStr, 10);
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    return `${h12}:${mStr} ${h24 >= 12 ? 'PM' : 'AM'}`;
  };

  const handleTimeConfirm = (newTime: string) => {
    setTime(newTime);
    setShowTimePicker(false);
  };

  const swapLocations = useCallback(() => {
    const t = from;
    setFrom(to);
    setTo(t);
  }, [from, to]);

  const getFiltered = (text: string) =>
    text.trim()
      ? ALL_LOCATIONS.filter(l => l.toLowerCase().includes(text.toLowerCase())).slice(0, 5)
      : DEFAULT_SUGGESTIONS;

  const onFromFocus = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setActiveInput('from');
    setSuggestions(getFiltered(from));
  };
  const onToFocus = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setActiveInput('to');
    setSuggestions(getFiltered(to));
  };
  const onInputBlur = () => {
    hideTimer.current = setTimeout(() => {
      setActiveInput(null);
      setSuggestions([]);
    }, 180);
  };
  const onFromChange = (t: string) => { setFrom(t); setSuggestions(getFiltered(t)); };
  const onToChange = (t: string) => { setTo(t); setSuggestions(getFiltered(t)); };
  const pickSuggestion = (loc: string) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (activeInput === 'from') setFrom(loc); else setTo(loc);
    setSuggestions([]);
    setActiveInput(null);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Gradient Header ───────────────────────────────────────── */}
        <LinearGradient
          colors={[c.primary, c.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Back + Title */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                <Path d="M19 12H5M12 5l-7 7 7 7" />
              </Svg>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Find a Ride</Text>
          </View>

          {/* Route Input Card — white card with From/To */}
          <View style={[styles.routeCard, Shadow.md]}>
            {/* From input */}
            <View style={styles.inputRow}>
              <View style={[styles.dotFrom, { backgroundColor: c.primary }]} />
              <TextInput
                value={from}
                onChangeText={onFromChange}
                onFocus={onFromFocus}
                onBlur={onInputBlur}
                placeholder="From — Pickup location"
                placeholderTextColor={c.textDisabled}
                style={[styles.textInput, { color: c.text }]}
              />
              {from.length > 0 && (
                <TouchableOpacity onPress={() => setFrom('')}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill={c.textSec}>
                    <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </Svg>
                </TouchableOpacity>
              )}
            </View>

            {/* From suggestions */}
            {activeInput === 'from' && suggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {suggestions.map((loc, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => pickSuggestion(loc)}
                    style={[styles.suggestionItem, i < suggestions.length - 1 && styles.suggestionBorder]}
                  >
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill={c.textSec}>
                      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </Svg>
                    <Text style={[styles.suggestionText, { color: c.text }]}>{loc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Divider + Swap button */}
            <View style={styles.dividerRow}>
              <View style={[styles.verticalLine, { backgroundColor: c.border }]} />
              <View style={[styles.horizontalLine, { backgroundColor: c.border }]} />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={swapLocations}
                style={[styles.swapButton, { backgroundColor: c.primaryLight }]}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill={c.primary}>
                  <Path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* To input */}
            <View style={styles.inputRow}>
              <View style={[styles.dotTo, { backgroundColor: c.error }]} />
              <TextInput
                value={to}
                onChangeText={onToChange}
                onFocus={onToFocus}
                onBlur={onInputBlur}
                placeholder="To — Destination"
                placeholderTextColor={c.textDisabled}
                style={[styles.textInput, { color: c.text }]}
              />
              {to.length > 0 && (
                <TouchableOpacity onPress={() => setTo('')}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill={c.textSec}>
                    <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </Svg>
                </TouchableOpacity>
              )}
            </View>

            {/* To suggestions */}
            {activeInput === 'to' && suggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {suggestions.map((loc, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => pickSuggestion(loc)}
                    style={[styles.suggestionItem, i < suggestions.length - 1 && styles.suggestionBorder]}
                  >
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill={c.textSec}>
                      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </Svg>
                    <Text style={[styles.suggestionText, { color: c.text }]}>{loc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── Scrollable Content ────────────────────────────────────── */}
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Select on Map card */}
          <AnimatedPressable
            scaleValue={0.97}
            onPress={() => navigation.navigate('MapPicker', { field: 'from' })}
            style={[styles.mapPickerCard, Shadow.sm, { borderColor: c.primary + '30' }]}
          >
            <LinearGradient
              colors={[c.primaryLight, c.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.mapPickerInner}
            >
              <View style={[styles.mapPickerIcon, { backgroundColor: c.primaryLight }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill={c.primary}>
                  <Path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
                </Svg>
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.mapPickerTitle, { color: c.text }]}>
                  Select my location on a map
                </Text>
                <Text style={[styles.mapPickerSub, { color: c.textSec }]}>
                  Pin your exact pickup point
                </Text>
              </View>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill={c.primary}>
                <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
              </Svg>
            </LinearGradient>
          </AnimatedPressable>

          {/* Date & Time Row */}
          <Text style={[styles.sectionLabel, { color: c.textSec }]}>DATE & TIME</Text>
          <View style={styles.dateTimeRow}>
            {/* Date card */}
            <AnimatedPressable
              scaleValue={0.97}
              onPress={() => setShowCalendar(true)}
              style={[
                styles.dtCard,
                Shadow.sm,
                {
                  backgroundColor: c.surface,
                  borderColor: showCalendar ? c.primary : c.border,
                },
              ]}
            >
              <View style={[styles.dtIconWrap, { backgroundColor: c.primaryLight }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill={c.primary}>
                  <Path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z" />
                </Svg>
              </View>
              <View style={styles.dtTextWrap}>
                <Text style={[styles.dtLabel, { color: c.textSec }]}>DATE</Text>
                <Text style={[styles.dtValue, { color: c.text }]} numberOfLines={1}>
                  {formatSelectedDate(selectedDate)}
                </Text>
              </View>
            </AnimatedPressable>

            {/* Time card */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowTimePicker(true)}
              style={[
                styles.dtCard,
                Shadow.sm,
                {
                  backgroundColor: c.surface,
                  borderColor: showTimePicker ? c.primary : c.border,
                },
              ]}
            >
              <View style={[styles.dtIconWrap, { backgroundColor: c.primaryLight }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill={c.primary}>
                  <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </Svg>
              </View>
              <View style={styles.dtTextWrap}>
                <Text style={[styles.dtLabel, { color: c.textSec }]}>TIME</Text>
                <Text style={[styles.dtValue, { color: c.text }]}>{formatTime(time)}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Seats selector */}
          <View
            style={[
              styles.seatsRow,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={styles.seatsLeft}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill={c.primary}>
                <Path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </Svg>
              <Text style={[styles.seatsLabel, { color: c.text }]}>Seats needed</Text>
            </View>
            <View style={styles.seatsControls}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSeats(Math.max(1, seats - 1))}
                style={[styles.seatBtn, { backgroundColor: c.border }]}
              >
                <Svg width={12} height={12} viewBox="0 0 24 24" fill={c.textSec}>
                  <Path d="M19 13H5v-2h14v2z" />
                </Svg>
              </TouchableOpacity>
              <Text style={[styles.seatsCount, { color: c.text }]}>{seats}</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSeats(Math.min(4, seats + 1))}
                style={[styles.seatBtn, { backgroundColor: c.primaryLight }]}
              >
                <Svg width={12} height={12} viewBox="0 0 24 24" fill={c.primary}>
                  <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Searches — shown when both inputs are empty */}
          {!from && !to && (
            <View style={styles.recentSection}>
              <Text style={[styles.sectionLabel, { color: c.textSec }]}>RECENT SEARCHES</Text>
              <View style={styles.recentList}>
                {recentSearches.map((s, i) => (
                  <AnimatedPressable
                    key={i}
                    scaleValue={0.98}
                    onPress={() => { setFrom(s.from); setTo(s.to); }}
                    style={[
                      styles.recentCard,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill={c.textSec}>
                      <Path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                    </Svg>
                    <View style={styles.flex1}>
                      <Text style={[styles.recentFrom, { color: c.text }]}>{s.from}</Text>
                      <Text style={[styles.recentTo, { color: c.textSec }]}>→ {s.to}</Text>
                    </View>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Search CTA ────────────────────────────────────────────── */}
        <View style={styles.ctaWrap}>
          <AnimatedPressable
            scaleValue={0.97}
            onPress={async () => {
              if (!canSearch || searching) return;
              setSearching(true);
              try {
                const scheduledAt = selectedDate ? new Date(selectedDate) : new Date();
                const [hours, minutes] = time.split(':');
                scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0);

                // TODO: Integrate with maps service to get real coordinates
                // For now, use default coordinates for Bangalore
                const results = await rideService.searchRides({
                  pickupLat: 12.9716,
                  pickupLng: 77.5946,
                  dropoffLat: 12.9352,
                  dropoffLng: 77.6245,
                  departureTime: scheduledAt.toISOString(),
                });

                logger.info('Search successful', { results: results.data.items?.length || 0 });
                navigation.navigate('RideResults', { rides: results });
              } catch (error) {
                logger.error('Search failed', { error });
                Alert.alert('Search Error', error instanceof Error ? error.message : 'Failed to search rides');
              } finally {
                setSearching(false);
              }
            }}
            style={styles.ctaPressable}
          >
            <LinearGradient
              colors={canSearch ? [c.primary, c.primaryDark] : [c.border, c.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.ctaButton,
                canSearch && Shadow.primary(c.primary),
              ]}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                <Path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </Svg>
              {searching ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={[styles.ctaText, { color: canSearch ? 'white' : c.textSec }]}>
                  Search Rides
                </Text>
              )}
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>

      {/* Calendar Modal */}
      <RideDatePicker
        visible={showCalendar}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        onClose={() => setShowCalendar(false)}
      />

      <ClockTimePicker
        visible={showTimePicker}
        initialTime={time}
        onConfirm={handleTimeConfirm}
        onDismiss={() => setShowTimePicker(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: Typography.bold,
    color: 'white',
  },

  // ── Route Card ──────────────────────────────────────────────────
  routeCard: {
    borderRadius: Radius.xl,
    backgroundColor: 'white',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  dotFrom: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },
  dotTo: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.lg,
    padding: 0, // remove default Android padding
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  verticalLine: {
    marginLeft: 4,
    width: 2,
    height: 16,
  },
  horizontalLine: {
    flex: 1,
    height: 1,
  },
  swapButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll Content ──────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    marginBottom: 10,
  },

  // ── Date & Time ─────────────────────────────────────────────────
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',   // guarantees equal height on both cards
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  dtCard: {
    flex: 1,                 // equal width: each card gets 50% of the row
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dtIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dtTextWrap: {
    flex: 1,
  },
  dtLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  dtValue: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },

  // ── Seats ───────────────────────────────────────────────────────
  seatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
  },
  seatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  seatsLabel: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  seatsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  seatBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatsCount: {
    fontSize: 18,
    fontWeight: Typography.extrabold,
    minWidth: 20,
    textAlign: 'center',
  },

  // ── Recent Searches ─────────────────────────────────────────────
  recentSection: {
    marginTop: Spacing.xs,
  },
  recentList: {
    gap: Spacing.sm,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg - 2,
    paddingVertical: Spacing.md,
  },
  recentFrom: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  recentTo: {
    fontSize: Typography.sm,
  },

  // ── CTA ─────────────────────────────────────────────────────────
  ctaWrap: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  ctaPressable: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  ctaButton: {
    height: 56,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  ctaText: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
  },

  // ── Map Picker Card ───────────────────────────────────
  mapPickerCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  mapPickerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
  },
  mapPickerIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickerTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    marginBottom: 2,
  },
  mapPickerSub: {
    fontSize: Typography.sm,
  },

  // ── Suggestions ─────────────────────────────────────────────────
  suggestionBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingBottom: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
  },

});
