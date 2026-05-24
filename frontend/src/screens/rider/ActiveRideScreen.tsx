import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Image,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { rideService } from '../../services/rideService';
import type { Ride } from '../../types/api';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveMap } from '../../components/LiveMap';
import type { RootStackParamList } from '../../navigation/types';
import { Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RidePhase = 'driver_arriving' | 'in_progress' | 'arrived' | 'rating';

/* ── Animated Pressable helper ──────────────────────────────────── */
const AnimatedPressable = ({
  onPress,
  style,
  children,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
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

/* ── Star Rating Component ──────────────────────────────────────── */
const StarRating = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => (
  <View style={styles.starRow}>
    {[1, 2, 3, 4, 5].map(s => (
      <Pressable key={s} onPress={() => onChange(s)} hitSlop={6}>
        <Svg width={32} height={32} viewBox="0 0 24 24">
          <Path
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            fill={s <= value ? '#FFB300' : '#E0E0E0'}
          />
        </Svg>
      </Pressable>
    ))}
  </View>
);

/* ── Pulsing Dot (replaces motion scale loop) ───────────────────── */
const PulsingDot = () => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'white',
        transform: [{ scale: anim }],
      }}
    />
  );
};

/* ── Slide-in animation wrapper ─────────────────────────────────── */
const SlideIn = ({ children }: { children: React.ReactNode }) => {
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [translateY, opacity]);
  return (
    <Animated.View style={{ transform: [{ translateY }], opacity }}>
      {children}
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
export function ActiveRideScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const route = useRoute<RouteProp<RootStackParamList, 'ActiveRide'>>();
  const rideId = route.params?.rideId;

  const [phase, setPhase] = useState<RidePhase>('driver_arriving');
  const [rating, setRating] = useState(0);
  const [deviation, setDeviation] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rideData, setRideData] = useState<Ride | null>(null);

  useEffect(() => {
    if (!rideId) return;

    const fetchRide = async () => {
      try {
        const data = await rideService.getRide(rideId);
        setRideData(data);
        
        // Map status to phase roughly if needed (optional since we have manual buttons in UI for simulation)
        if (data.status === 'completed' && phase !== 'rating') {
          setPhase('rating');
        }
      } catch (error) {
        console.error('Failed to poll ride', error);
      }
    };

    fetchRide();
    const interval = setInterval(fetchRide, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, [rideId, phase]);

  const driverName = rideData?.driver?.name || 'Rajesh Kumar';
  const driverAvatar = rideData?.driver?.profilePhotoUrl || 'https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=60&h=60&fit=crop';
  const vehicleName = rideData?.vehicle ? `${rideData.vehicle.make} ${rideData.vehicle.model}` : 'Swift Dzire';
  const plateNumber = rideData?.vehicle?.plateNumber || 'KA 05 AB 1234';
  const price = rideData?.pricePerSeat || 198;
  const fromAddress = rideData?.pickupLocation?.address || 'Koramangala 6th Block';
  const toAddress = rideData?.dropoffLocation?.address || 'MG Road';

  const toggleTag = (tag: string) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );

  /* ── Phase: Driver Arriving ─────────────────────────────────────── */
  const renderDriverArriving = () => (
    <>
      {/* ETA Banner */}
      <SlideIn>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, Shadow.sm]}>
          <View style={[styles.etaIcon, { backgroundColor: c.primaryLight }]}>
            <Text style={{ fontSize: 26 }}>🚗</Text>
          </View>
          <View style={styles.flex1}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>5 min away</Text>
            <Text style={{ fontSize: 13, color: c.textSec }}>{driverName} is on his way</Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, color: c.textSec }}>ETA</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>9:05</Text>
          </View>
        </View>
      </SlideIn>

      {/* Ride Timeline */}
      <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 }}>
          Ride Timeline
        </Text>
        {([
          { label: 'Driver arriving', sub: `5 min · ${fromAddress}`, done: false, active: true },
          { label: 'Pickup', sub: '9:05 AM est.', done: false, active: false },
          { label: 'In progress', sub: '~38 min ride', done: false, active: false },
          { label: `Drop at ${toAddress}`, sub: '9:43 AM est.', done: false, active: false },
        ] as const).map((step, i) => (
          <View key={i} style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: step.active
                      ? c.primary
                      : step.done
                      ? c.success
                      : c.border,
                  },
                ]}
              >
                {step.done && (
                  <Svg width={10} height={10} viewBox="0 0 24 24">
                    <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white" />
                  </Svg>
                )}
                {step.active && <PulsingDot />}
              </View>
              {i < 3 && (
                <View style={[styles.timelineLine, { backgroundColor: c.border }]} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: step.active ? '700' : '500',
                  color: step.active ? c.text : c.textSec,
                }}
              >
                {step.label}
              </Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>{step.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Driver card */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Image
          source={{ uri: driverAvatar }}
          style={styles.driverAvatar}
        />
        <View style={styles.flex1}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{driverName}</Text>
          <Text style={{ fontSize: 13, color: c.textSec }}>{vehicleName} · {plateNumber}</Text>
        </View>
        <View style={styles.actionBtns}>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: c.successLight }]}
            onPress={() => {/* phone */}}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                fill={c.success}
              />
            </Svg>
          </Pressable>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: c.primaryLight }]}
            onPress={() => navigation.navigate('Chat', { chatId: 'driver_1', recipientName: driverName })}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
                fill={c.primary}
              />
            </Svg>
          </Pressable>
        </View>
      </View>

      {/* Share trip */}
      <View style={styles.mx4}>
        <Pressable
          style={[styles.shareBtn, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
              fill={c.textSec}
            />
          </Svg>
          <Text style={{ fontSize: 14, color: c.textSec, marginLeft: 8 }}>Share trip with family</Text>
        </Pressable>
      </View>

      {/* Simulate button */}
      <View style={styles.mx4}>
        <AnimatedPressable onPress={() => setPhase('in_progress')}>
          <LinearGradient
            colors={[c.primary, '#0D47A1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.simulateBtn}
          >
            <Text style={styles.simulateBtnText}>Simulate: Driver Arrived</Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </>
  );

  /* ── Phase: In Progress ─────────────────────────────────────────── */
  const renderInProgress = () => (
    <>
      {/* Deviation alert */}
      {deviation && (
        <SlideIn>
          <View style={styles.deviationCard}>
            <Svg width={18} height={18} viewBox="0 0 24 24" style={{ flexShrink: 0 } as unknown as never}>
              <Path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="#FF8A50" />
            </Svg>
            <View style={styles.flex1}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#CC5520' }}>
                Route Deviation Detected
              </Text>
              <Text style={{ fontSize: 12, color: '#CC5520' }}>
                Driver has deviated 500m from planned route
              </Text>
            </View>
            <Pressable onPress={() => setDeviation(false)} hitSlop={8}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  fill="#FF8A50"
                />
              </Svg>
            </Pressable>
          </View>
        </SlideIn>
      )}

      {/* ETA card */}
      <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: c.primary }}>22 min</Text>
            <Text style={{ fontSize: 13, color: c.textSec }}>to MG Road</Text>
          </View>
          <View style={[styles.arrivalBadge, { backgroundColor: c.successLight }]}>
            <Text style={{ fontSize: 11, color: c.textSec }}>ARRIVE AT</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.success }}>9:41 AM</Text>
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: c.bg }]}>
            <View style={[styles.progressFill, { width: '45%', backgroundColor: c.primary }]} />
          </View>
          <Text style={{ fontSize: 12, color: c.textSec }}>5.4 km left</Text>
        </View>
      </View>

      {/* Simulate arrived */}
      <View style={styles.mx4}>
        <AnimatedPressable onPress={() => setPhase('arrived')}>
          <LinearGradient
            colors={[c.success, '#00952A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.arrivedBtn}
          >
            <Text style={styles.simulateBtnText}>Simulate: Arrived</Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </>
  );

  /* ── Phase: Arrived ─────────────────────────────────────────────── */
  const renderArrived = () => (
    <View style={styles.arrivedWrap}>
      {/* Celebration banner */}
      <View style={[styles.celebBanner, { backgroundColor: c.successLight, borderColor: `${c.success}30` }]}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: c.success, textAlign: 'center' }}>
          You've Arrived! 🎉
        </Text>
        <Text style={{ fontSize: 14, color: c.textSec, marginTop: 4, textAlign: 'center' }}>
          at {toAddress}
        </Text>
      </View>

      {/* Ride Summary */}
      <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border, marginHorizontal: 0 }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 }}>
          Ride Summary
        </Text>
        {([
          { label: 'Distance', value: '12.4 km', bold: false },
          { label: 'Duration', value: '41 min', bold: false },
          { label: 'Paid', value: `₹${price}`, bold: true },
        ] as const).map((row, i) => (
          <View key={i} style={[styles.summaryRow, i < 2 && { marginBottom: 8 }]}>
            <Text style={{ fontSize: 14, color: c.textSec }}>{row.label}</Text>
            <Text
              style={{
                fontSize: row.bold ? 16 : 14,
                fontWeight: row.bold ? '700' : '600',
                color: row.bold ? c.success : c.text,
              }}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Rate CTA */}
      <AnimatedPressable onPress={() => setPhase('rating')}>
        <LinearGradient
          colors={[c.primary, c.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryCta}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Rate Your Ride</Text>
        </LinearGradient>
      </AnimatedPressable>
    </View>
  );

  /* ── Phase: Rating ──────────────────────────────────────────────── */
  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];
  const tags = ['Punctual', 'Safe Driving', 'Clean Car', 'Friendly', 'Good Music'];

  const renderRating = () => (
    <View style={styles.ratingWrap}>
      {/* Header text */}
      <View style={styles.ratingHeader}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
          How was your ride?
        </Text>
        <Text style={{ fontSize: 14, color: c.textSec, marginTop: 4, textAlign: 'center' }}>
          Your feedback helps drivers improve
        </Text>
      </View>

      {/* Driver card + stars */}
      <View style={[styles.ratingCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Image
          source={{ uri: driverAvatar }}
          style={styles.ratingAvatar}
        />
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginTop: 8 }}>
          {driverName}
        </Text>
        <View style={{ marginTop: 12 }}>
          <StarRating value={rating} onChange={setRating} />
        </View>
        {rating > 0 && (
          <Text style={{ fontSize: 14, color: c.textSec, marginTop: 8 }}>
            {ratingLabels[rating]}
          </Text>
        )}
      </View>

      {/* Tags */}
      <View style={styles.tagsWrap}>
        {tags.map(tag => {
          const selected = selectedTags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggleTag(tag)}
              style={[
                styles.tagChip,
                {
                  backgroundColor: selected ? c.primaryLight : c.surface,
                  borderColor: selected ? c.primary : c.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: selected ? c.primary : c.textSec,
                  fontWeight: selected ? '600' : '400',
                }}
              >
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Submit */}
      <AnimatedPressable onPress={() => navigation.navigate('RiderTabs' as unknown as never)}>
        <LinearGradient
          colors={[c.primary, c.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryCta}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Submit & Done</Text>
        </LinearGradient>
      </AnimatedPressable>

      {/* Skip */}
      <Pressable onPress={() => navigation.navigate('RiderTabs' as unknown as never)} style={styles.skipBtn}>
        <Text style={{ fontSize: 14, color: c.textSec }}>Skip for now</Text>
      </Pressable>
    </View>
  );

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* Map header */}
      <View style={styles.mapWrap}>
        <LiveMap showRoute showDriver style={StyleSheet.absoluteFillObject} />

        {/* Overlay controls */}
        <View style={styles.mapOverlay}>
          <AnimatedPressable onPress={() => navigation.goBack()}>
            <View style={styles.backBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 12H5M12 5l-7 7 7 7"
                  stroke="#1A1A2E"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              </Svg>
            </View>
          </AnimatedPressable>

          <View style={styles.statusChip}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>
              {phase === 'driver_arriving'
                ? '🚗 Driver En Route'
                : phase === 'in_progress'
                ? '🟢 Ride In Progress'
                : '✅ Arrived'}
            </Text>
          </View>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'driver_arriving' && renderDriverArriving()}
        {phase === 'in_progress' && renderInProgress()}
        {phase === 'arrived' && renderArrived()}
        {phase === 'rating' && renderRating()}
      </ScrollView>

      {/* SOS FAB */}
      {phase !== 'rating' && (
        <AnimatedPressable
          onPress={() => navigation.navigate('SOS')}
          style={[styles.sosFab, { backgroundColor: c.error }]}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill="white"
            />
          </Svg>
        </AnimatedPressable>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Map */
  mapWrap: { height: 220, position: 'relative' },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'white',
    ...Shadow.md,
  },

  /* Scroll */
  scrollContent: { paddingBottom: 100 },

  /* Cards */
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: Radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  mx4: { marginHorizontal: 16, marginTop: 12 },

  /* ETA banner */
  etaIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Timeline */
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  timelineLeft: { alignItems: 'center' },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: { width: 1.5, height: 16, marginVertical: 2 },

  /* Driver card */
  driverAvatar: { width: 48, height: 48, borderRadius: 14 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Share trip */
  shareBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Buttons */
  simulateBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  simulateBtnText: { fontSize: 15, fontWeight: '700', color: 'white' },
  arrivedBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryCta: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  /* Deviation */
  deviationCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: '#FFF3EE',
    borderWidth: 1,
    borderColor: '#FF8A5040',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },

  /* Progress bar */
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  arrivalBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  /* Arrived phase */
  arrivedWrap: { marginHorizontal: 16, marginTop: 16, gap: 12 },
  celebBanner: { padding: 16, borderRadius: Radius.xl, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },

  /* Rating phase */
  ratingWrap: { marginHorizontal: 16, marginTop: 16, gap: 16 },
  ratingHeader: { alignItems: 'center' },
  ratingCard: {
    padding: 16,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  ratingAvatar: { width: 64, height: 64, borderRadius: 32 },
  starRow: { flexDirection: 'row', gap: 8 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  skipBtn: { alignItems: 'center', paddingVertical: 4 },

  /* SOS */
  sosFab: {
    position: 'absolute',
    bottom: 85,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 10,
  },
});
