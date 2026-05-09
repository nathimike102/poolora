import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Animated,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';
import { fetchPlaceSuggestions, PlaceSuggestion } from '../../services/placesService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STEPS = ['Route', 'Schedule', 'Price', 'Preferences', 'Review'] as const;

/* ── Helpers ─────────────────────────────────────────────────── */
const AnimatedPressable = ({
  onPress,
  style,
  children,
}: {
  onPress?: () => void;
  style?: any;
  children: React.ReactNode;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  return (
    <Pressable onPressIn={onIn} onPressOut={onOut} onPress={onPress}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const prefOptions = [
  { id: 'ac', label: 'AC', icon: '❄️', enabled: true },
  { id: 'no_smoke', label: 'No Smoking', icon: '🚭', enabled: true },
  { id: 'music', label: 'Music OK', icon: '🎵', enabled: true },
  { id: 'no_pets', label: 'No Pets', icon: '🐾', enabled: false },
  { id: 'female', label: 'Ladies Only', icon: '👩', enabled: false },
  { id: 'chat', label: 'Chatty', icon: '💬', enabled: true },
];

/* ═══════════════════════════════════════════════════════════════ */
export function CreateRideScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('Tomorrow');
  const [time, setTime] = useState('08:30');
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState(220);
  const [recurring, setRecurring] = useState(false);
  const [published, setPublished] = useState(false);
  const [prefs, setPrefs] = useState(prefOptions.map(p => p.enabled));

  /* ── Location suggestions ────────────────────────────────── */
  const [fromSuggestions, setFromSuggestions] = useState<PlaceSuggestion[]>([]);
  const [toSuggestions, setToSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const fromTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFromChange = useCallback((text: string) => {
    setFrom(text);
    if (fromTimer.current) clearTimeout(fromTimer.current);
    if (!text.trim()) { setFromSuggestions([]); setShowFromSuggestions(false); return; }
    fromTimer.current = setTimeout(async () => {
      const results = await fetchPlaceSuggestions(text);
      setFromSuggestions(results);
      setShowFromSuggestions(results.length > 0);
    }, 300);
  }, []);

  const handleToChange = useCallback((text: string) => {
    setTo(text);
    if (toTimer.current) clearTimeout(toTimer.current);
    if (!text.trim()) { setToSuggestions([]); setShowToSuggestions(false); return; }
    toTimer.current = setTimeout(async () => {
      const results = await fetchPlaceSuggestions(text);
      setToSuggestions(results);
      setShowToSuggestions(results.length > 0);
    }, 300);
  }, []);

  const selectFromSuggestion = useCallback((s: PlaceSuggestion) => {
    setFrom(s.name); setShowFromSuggestions(false); setFromSuggestions([]); Keyboard.dismiss();
  }, []);

  const selectToSuggestion = useCallback((s: PlaceSuggestion) => {
    setTo(s.name); setShowToSuggestions(false); setToSuggestions([]); Keyboard.dismiss();
  }, []);

  useEffect(() => () => {
    if (fromTimer.current) clearTimeout(fromTimer.current);
    if (toTimer.current) clearTimeout(toTimer.current);
  }, []);

  const aiSuggestedPrice = 210;
  const priceOptions = [
    { label: 'Low', price: Math.round(aiSuggestedPrice * 0.85), note: '-15%' },
    { label: 'Suggested', price: aiSuggestedPrice, note: 'AI Match' },
    { label: 'High', price: Math.round(aiSuggestedPrice * 1.3), note: '+30%' },
  ];

  /* ── Published state animation ─────────────────────────────── */
  const pubScale = useRef(new Animated.Value(0)).current;
  const pubRotate = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (published) {
      Animated.spring(pubScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      Animated.spring(pubRotate, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      Animated.timing(barWidth, { toValue: 1, duration: 800, delay: 500, useNativeDriver: false }).start();
    }
  }, [published]);

  const handlePublish = () => setPublished(true);

  /* ═════════════ PUBLISHED SUCCESS VIEW ═════════════════════════ */
  if (published) {
    const spin = pubRotate.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });
    return (
      <View style={[styles.root, styles.publishRoot, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <Animated.View
          style={{
            width: 90,
            height: 90,
            borderRadius: 45,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transform: [{ scale: pubScale }, { rotate: spin }],
          }}
        >
          <LinearGradient
            colors={[c.success, '#00952A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.publishCircle}
          >
            <Text style={{ fontSize: 40 }}>🚗</Text>
          </LinearGradient>
        </Animated.View>

        <Text style={{ fontSize: 24, fontWeight: '800', color: c.text, marginTop: 20 }}>
          Ride Published!
        </Text>
        <Text style={{ fontSize: 15, color: c.textSec, marginTop: 8, textAlign: 'center' }}>
          HSR Layout → Whitefield · Tomorrow 8:30 AM
        </Text>

        {/* AI match card */}
        <View style={[styles.pubCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.pubCardRow}>
            <Text style={{ fontSize: 14, color: c.textSec }}>AI Match Estimate</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.success }}>High chance of booking</Text>
          </View>
          <View style={[styles.pubBarBg, { backgroundColor: c.bg }]}>
            <Animated.View
              style={{
                height: 8,
                borderRadius: 4,
                width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '78%'] }),
              }}
            >
              <LinearGradient
                colors={[c.success, '#00E676']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1, borderRadius: 4 }}
              />
            </Animated.View>
          </View>
          <Text style={{ fontSize: 12, color: c.textSec, marginTop: 4 }}>78% match probability</Text>
        </View>

        {/* CTA */}
        <AnimatedPressable
          onPress={() => {
            setPublished(false);
            setStep(0);
            setFrom('');
            setTo('');
            setSeats(3);
            setPrice(220);
            setRecurring(false);
            navigation.reset({ index: 0, routes: [{ name: 'DriverTabs' as any }] });
          }}
          style={{ marginTop: 20 }}
        >
          <LinearGradient
            colors={[c.primary, '#0D47A1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.publishCTAInner}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>Back to Home</Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    );
  }

  /* ═════════════ STEP RENDERS ═══════════════════════════════════ */

  const renderSuggestions = (
    suggestions: PlaceSuggestion[],
    onSelect: (s: PlaceSuggestion) => void,
  ) => (
    <View style={styles.suggestionContainer}>
      {suggestions.map((s, i) => (
        <Pressable key={s.placeId} onPress={() => onSelect(s)}>
          <View style={[styles.suggestionItem, i < suggestions.length - 1 && styles.suggestionBorder]}>
            <Text style={{ fontSize: 15, marginRight: 10 }}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{s.name}</Text>
              {!!s.subtitle && (
                <Text style={{ fontSize: 12, color: c.textSec, marginTop: 2 }}>{s.subtitle}</Text>
              )}
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );

  const renderRouteStep = () => (
    <Pressable style={{ gap: 16 }} onPress={() => { setShowFromSuggestions(false); setShowToSuggestions(false); }}>
      {/* From / To */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.inputRow}>
          <View style={[styles.dot, { backgroundColor: c.primary }]} />
          <TextInput
            value={from}
            onChangeText={handleFromChange}
            onFocus={() => from.trim() && fromSuggestions.length > 0 && setShowFromSuggestions(true)}
            placeholder="Starting point"
            placeholderTextColor={c.textSec}
            style={[styles.input, { color: c.text }]}
          />
        </View>
        {showFromSuggestions && renderSuggestions(fromSuggestions, selectFromSuggestion)}
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        <View style={styles.inputRow}>
          <View style={[styles.squareDot, { backgroundColor: c.error }]} />
          <TextInput
            value={to}
            onChangeText={handleToChange}
            onFocus={() => to.trim() && toSuggestions.length > 0 && setShowToSuggestions(true)}
            placeholder="Destination"
            placeholderTextColor={c.textSec}
            style={[styles.input, { color: c.text }]}
          />
        </View>
        {showToSuggestions && renderSuggestions(toSuggestions, selectToSuggestion)}
      </View>

      {/* Distance warning */}
      <View style={[styles.warningBox, { backgroundColor: c.warningLight }]}>
        <Svg width={16} height={16} viewBox="0 0 24 24" style={{ marginTop: 1 }}>
          <Path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill={c.warning} />
        </Svg>
        <Text style={{ fontSize: 12, color: '#7A5200', flex: 1 }}>
          Maximum route distance is <Text style={{ fontWeight: '700' }}>300 km</Text>. Long-distance rides require prior approval.
        </Text>
      </View>

      {/* Seats */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 }}>
          Available Seats
        </Text>
        <View style={styles.seatsWrap}>
          <Pressable
            onPress={() => setSeats(Math.max(1, seats - 1))}
            style={[styles.seatBtn, { backgroundColor: c.bg, borderColor: c.border }]}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M19 13H5v-2h14v2z" fill={c.textSec} />
            </Svg>
          </Pressable>

          <View style={styles.seatIcons}>
            {[1, 2, 3, 4].map(n => (
              <View
                key={n}
                style={[
                  styles.seatIcon,
                  {
                    backgroundColor: n <= seats ? c.primary : c.bg,
                    borderColor: n <= seats ? c.primary : c.border,
                  },
                ]}
              >
                {n <= seats && <Text style={{ fontSize: 16 }}>🧑</Text>}
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => setSeats(Math.min(4, seats + 1))}
            style={[styles.seatBtn, { backgroundColor: c.primaryLight }]}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill={c.primary} />
            </Svg>
          </Pressable>
        </View>
        <Text style={{ fontSize: 12, color: c.textSec, marginTop: 10, textAlign: 'center' }}>
          {seats} seat{seats > 1 ? 's' : ''} available
        </Text>
      </View>

      {/* Active rides info */}
      <View style={[styles.warningBox, { backgroundColor: c.primaryLight }]}>
        <Svg width={16} height={16} viewBox="0 0 24 24" style={{ marginTop: 1 }}>
          <Path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
            fill={c.primary}
          />
        </Svg>
        <Text style={{ fontSize: 12, color: c.primary, flex: 1 }}>
          You can have a maximum of <Text style={{ fontWeight: '700' }}>5 active rides</Text> at a time. You currently have 1.
        </Text>
      </View>
    </Pressable>
  );

  const renderScheduleStep = () => (
    <View style={{ gap: 16 }}>
      {/* Date */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 }}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
            {['Today', 'Tomorrow', 'Sat 1 Mar', 'Sun 2 Mar', 'Mon 3 Mar'].map(d => (
              <Pressable key={d} onPress={() => setDate(d)}>
                <View
                  style={[
                    styles.dateChip,
                    {
                      borderColor: date === d ? c.primary : c.border,
                      backgroundColor: date === d ? c.primaryLight : c.bg,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: date === d ? c.primary : c.textSec,
                    }}
                  >
                    {d}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Time */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 }}>
          Departure Time
        </Text>
        <TextInput
          value={time}
          onChangeText={setTime}
          placeholder="08:30"
          placeholderTextColor={c.textSec}
          keyboardType="numbers-and-punctuation"
          style={{ fontSize: 28, fontWeight: '700', color: c.primary }}
        />
      </View>

      {/* Recurring */}
      <View style={[styles.card, styles.rowBetween, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Recurring Ride</Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>Repeat this ride every weekday</Text>
        </View>
        <Switch
          value={recurring}
          onValueChange={setRecurring}
          trackColor={{ false: c.border, true: c.primary }}
          thumbColor="white"
        />
      </View>
    </View>
  );

  const renderPriceStep = () => (
    <View style={{ gap: 16 }}>
      {/* AI suggestion */}
      <LinearGradient
        colors={[c.primaryLight, c.successLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.aiBox}
      >
        <Text style={{ fontSize: 24 }}>🤖</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>AI Price Suggestion</Text>
          <Text style={{ fontSize: 13, color: c.textSec, lineHeight: 18, marginTop: 2 }}>
            Based on route, time, and demand, we suggest{' '}
            <Text style={{ fontWeight: '700', color: c.primary }}>₹{aiSuggestedPrice}/seat</Text> for
            maximum booking probability.
          </Text>
        </View>
      </LinearGradient>

      {/* Price options */}
      <View style={styles.priceRow}>
        {priceOptions.map(opt => (
          <AnimatedPressable
            key={opt.label}
            onPress={() => setPrice(opt.price)}
            style={{ flex: 1 }}
          >
            <View
              style={[
                styles.priceCard,
                {
                  borderColor: price === opt.price ? c.primary : c.border,
                  backgroundColor: price === opt.price ? c.primaryLight : c.surface,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: price === opt.price ? c.primary : c.text,
                }}
              >
                ₹{opt.price}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: price === opt.price ? c.primary : c.textSec,
                }}
              >
                {opt.label}
              </Text>
              <View
                style={[
                  styles.priceBadge,
                  {
                    backgroundColor:
                      opt.label === 'Suggested'
                        ? c.success
                        : opt.label === 'Low'
                        ? c.textSec
                        : c.accent,
                  },
                ]}
              >
                <Text style={{ fontSize: 10, color: 'white' }}>{opt.note}</Text>
              </View>
            </View>
          </AnimatedPressable>
        ))}
      </View>

      {/* Custom price */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 }}>
          Custom Price
        </Text>
        <View style={styles.rowBetween}>
          <Text style={{ fontSize: 12, color: c.textSec }}>₹100</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>₹{price}</Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>₹350</Text>
        </View>

        {/* Simple stepper row as Slider replacement */}
        <View style={[styles.sliderTrack, { backgroundColor: c.border }]}>
          <View
            style={[
              styles.sliderFill,
              {
                backgroundColor: c.primary,
                width: `${((price - 100) / 250) * 100}%` as any,
              },
            ]}
          />
        </View>
        <View style={styles.sliderBtns}>
          <Pressable onPress={() => setPrice(Math.max(100, price - 10))}>
            <View style={[styles.sliderBtn, { borderColor: c.border }]}>
              <Text style={{ fontSize: 16, color: c.textSec }}>−</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setPrice(Math.min(350, price + 10))}>
            <View style={[styles.sliderBtn, { borderColor: c.border }]}>
              <Text style={{ fontSize: 16, color: c.primary }}>+</Text>
            </View>
          </Pressable>
        </View>

        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <Text style={{ fontSize: 12, color: c.textSec }}>
            Total earnings:{' '}
            <Text style={{ fontWeight: '700', color: c.success }}>₹{price * seats}</Text> (if full)
          </Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>Platform: 10%</Text>
        </View>
      </View>

      {/* Surge indicator */}
      <View style={styles.surgeBox}>
        <Text style={{ fontSize: 20 }}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#CC5520' }}>
            Surge Demand Detected
          </Text>
          <Text style={{ fontSize: 12, color: '#CC5520' }}>
            High demand on this route tomorrow. Consider setting price higher!
          </Text>
        </View>
      </View>
    </View>
  );

  const renderPreferencesStep = () => (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 14, color: c.textSec }}>
        Set your ride preferences to attract compatible passengers
      </Text>
      <View style={styles.prefGrid}>
        {prefOptions.map((pref, i) => (
          <Pressable
            key={pref.id}
            onPress={() =>
              setPrefs(prev => {
                const n = [...prev];
                n[i] = !n[i];
                return n;
              })
            }
            style={{ width: '48%' }}
          >
            <View
              style={[
                styles.prefChip,
                {
                  borderColor: prefs[i] ? c.primary : c.border,
                  backgroundColor: prefs[i] ? c.primaryLight : c.surface,
                },
              ]}
            >
              <Text style={{ fontSize: 22 }}>{pref.icon}</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: prefs[i] ? c.primary : c.textSec,
                  flex: 1,
                }}
              >
                {pref.label}
              </Text>
              {prefs[i] && (
                <View style={[styles.checkCircle, { backgroundColor: c.primary }]}>
                  <Svg width={10} height={10} viewBox="0 0 24 24">
                    <Path
                      d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
                      fill="white"
                    />
                  </Svg>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderReviewStep = () => {
    const items = [
      { label: 'Route', value: `${from} → ${to}` },
      { label: 'Date & Time', value: `${date} · ${time}` },
      { label: 'Seats Available', value: `${seats} seats` },
      { label: 'Price Per Seat', value: `₹${price}` },
      { label: 'Estimated Earnings', value: `₹${price * seats} (if full)` },
      { label: 'Recurring', value: recurring ? 'Every weekday' : 'One-time' },
    ];
    return (
      <View style={{ gap: 10 }}>
        {items.map(item => (
          <View
            key={item.label}
            style={[styles.reviewRow, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={{ fontSize: 14, color: c.textSec }}>{item.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, flexShrink: 1, textAlign: 'right' }}>
              {item.value}
            </Text>
          </View>
        ))}

        <View style={[styles.warningBox, { backgroundColor: c.successLight }]}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              fill={c.success}
            />
          </Svg>
          <Text style={{ fontSize: 12, color: '#1A6E30', flex: 1 }}>
            Ride will be visible to verified riders in your route after publishing
          </Text>
        </View>
      </View>
    );
  };

  const stepRenderers = [renderRouteStep, renderScheduleStep, renderPriceStep, renderPreferencesStep, renderReviewStep];

  /* ═════════════ MAIN LAYOUT ═══════════════════════════════════ */
  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={step === 0 ? () => navigation.goBack() : () => setStep(step - 1)} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Create Ride</Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={styles.stepBar}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.stepDot,
              { backgroundColor: i <= step ? c.primary : c.border },
            ]}
          />
        ))}
      </View>

      {/* Body */}
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {stepRenderers[step]()}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <AnimatedPressable
          onPress={() => {
            if (step < STEPS.length - 1) setStep(step + 1);
            else handlePublish();
          }}
          style={{ width: '100%' }}
        >
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>
              {step < STEPS.length - 1 ? `Continue to ${STEPS[step + 1]}` : '🚗 Publish Ride'}
            </Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },

  /* Steps */
  stepBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 12 },
  stepDot: { flex: 1, height: 4, borderRadius: 2 },

  scrollBody: { paddingHorizontal: 20, paddingBottom: 24 },

  /* Card */
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },

  /* Route inputs */
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  squareDot: { width: 10, height: 10, borderRadius: 2 },
  input: { flex: 1, fontSize: 15, padding: 0 },
  divider: { height: 1 },

  /* Suggestions */
  suggestionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 6,
    paddingVertical: 6,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionBorder: {
    borderBottomWidth: 0.5,
    borderColor: '#EEE',
  },

  /* Warning / Info boxes */
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },

  /* Seats */
  seatsWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seatBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatIcons: { flexDirection: 'row', gap: 8 },
  seatIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Date */
  dateChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5 },

  /* Price */
  aiBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 16 },
  priceRow: { flexDirection: 'row', gap: 12 },
  priceCard: {
    alignItems: 'center',
    gap: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  priceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },

  sliderTrack: { height: 6, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  sliderFill: { height: 6, borderRadius: 3 },
  sliderBtns: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
  sliderBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  surgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF3EE',
    borderWidth: 1,
    borderColor: '#FF8A5020',
  },

  /* Prefs */
  prefGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  prefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Review */
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  /* Bottom CTA */
  bottomBar: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12, borderTopWidth: 1 },
  ctaGradient: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  /* Published */
  publishRoot: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 4 },
  publishCircle: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  pubCard: {
    width: '100%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginTop: 20,
  },
  pubCardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  pubBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  publishCTAInner: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
