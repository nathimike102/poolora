/**
 * screens/rider/BookingScreen.tsx
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { bookingService } from '../../services/bookingService';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Booking'>;
type BookingRoute = RouteProp<RootStackParamList, 'Booking'>;

// ─── Types ────────────────────────────────────────────────────────────────────

type Gender = 'Male' | 'Female' | 'Other';

interface Passenger {
  name: string;
  gender: Gender | '';
}

const GENDERS: Gender[] = ['Male', 'Female', 'Other'];
const GENDER_ICONS: Record<Gender, string> = { Male: '👨', Female: '👩', Other: '🧑' };

// ─── AnimatedPressable ────────────────────────────────────────────────────────

function AnimatedPressable({
  onPress,
  disabled,
  scaleValue = 0.97,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  scaleValue?: number;
  style?: unknown;
  children: React.ReactNode;
}): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: scaleValue, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }, [scale, scaleValue]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scale]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

// ─── Confirmed Animation View ─────────────────────────────────────────────────

function ConfirmedView({ c }: { c: ReturnType<typeof useApp>['c'] }): React.ReactElement {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 8,
      bounciness: 12,
    }).start();
  }, [scale]);

  return (
    <View style={[styles.confirmedRoot, { backgroundColor: c.bg }]}>
      <Animated.View
        style={[
          styles.confirmedCircle,
          { backgroundColor: c.success, transform: [{ scale }] },
        ]}
      >
        <Svg width={40} height={40} viewBox="0 0 24 24" fill="white">
          <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </Svg>
      </Animated.View>
      <Text style={[styles.confirmedTitle, { color: c.text }]}>Request Sent!</Text>
      <Text style={[styles.confirmedSub, { color: c.textSec }]}>Taking you to payment...</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function BookingScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<BookingRoute>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const rideId = route.params?.rideId ?? '1';

  const [seats, setSeats] = useState(1);
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [passengers, setPassengers] = useState<Passenger[]>([
    { name: 'Priya Sharma', gender: 'Female' },
    { name: '', gender: '' },
    { name: '', gender: '' },
  ]);

  const pricePerSeat = 180;
  const platformFee = 18;
  const total = seats * pricePerSeat + platformFee;

  const updatePassenger = useCallback((idx: number, field: keyof Passenger, value: string) => {
    setPassengers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const passengersFilled = passengers
    .slice(0, seats)
    .every(p => p.name.trim() && p.gender);

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      
      const payload = {
        rideId,
        seatsBooked: seats,
        specialRequirements: message.trim() ? message.trim() : undefined,
      };

      await bookingService.createBooking(payload as any);
      
      setIsSubmitting(false);
      setConfirmed(true);
      
      // Navigate to payment after the success animation
      setTimeout(() => navigation.navigate('Payment', { rideId, amount: total }), 1800);
    } catch {
      setIsSubmitting(false);
      // Note: centralized error handler will catch and show toast
    }
  }, [navigation, rideId, seats, message, total, isSubmitting]);

  // ── Confirmed State ────────────────────────────────────────────
  if (confirmed) {
    return <ConfirmedView c={c} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: c.bg, borderColor: c.border }]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth={2.5} strokeLinecap="round">
              <Path d="M19 12H5M12 5l-7 7 7 7" />
            </Svg>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text }]}>Confirm Booking</Text>
        </View>

        {/* ── Scrollable Body ─────────────────────────────────────── */}
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ride Summary Card */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.driverRow}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=60&h=60&fit=crop' }}
                style={styles.driverAvatar}
                resizeMode="cover"
              />
              <View style={styles.flex1}>
                <Text style={[styles.driverName, { color: c.text }]}>Rajesh Kumar</Text>
                <Text style={[styles.driverMeta, { color: c.textSec }]}>Swift Dzire · KA 05 AB 1234</Text>
              </View>
              <View style={[styles.ratingBadge, { backgroundColor: c.successLight }]}>
                <Text style={[styles.ratingText, { color: c.success }]}>⭐ 4.9</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: c.border }]} />

            <View style={styles.routeSummary}>
              <View style={styles.flex1}>
                <Text style={[styles.routeLabel, { color: c.textSec }]}>PICKUP</Text>
                <Text style={[styles.routePlace, { color: c.text }]}>Koramangala 6th Block</Text>
                <Text style={[styles.routeTime, { color: c.primary }]}>Today · 9:00 AM</Text>
              </View>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill={c.textSec}>
                <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
              </Svg>
              <View style={[styles.flex1, styles.alignEnd]}>
                <Text style={[styles.routeLabel, { color: c.textSec }]}>DROP</Text>
                <Text style={[styles.routePlace, { color: c.text }]}>MG Road</Text>
                <Text style={[styles.routeTime, { color: c.textSec }]}>9:38 AM (est.)</Text>
              </View>
            </View>
          </View>

          {/* Pickup Warning */}
          <View style={[styles.warningBox, { backgroundColor: c.warningLight, borderColor: c.warning + '30' }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill={c.warning} style={styles.warnIcon}>
              <Path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </Svg>
            <Text style={styles.warningText}>
              Your pickup is within <Text style={styles.bold}>2km</Text> of driver's route. Exact pickup within 500m will be confirmed after booking.
            </Text>
          </View>

          {/* Seat Selector */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Number of Seats</Text>
            <View style={styles.seatRow}>
              {[1, 2, 3].map(n => (
                <TouchableOpacity
                  key={n}
                  activeOpacity={0.7}
                  onPress={() => setSeats(n)}
                  style={[
                    styles.seatBtn,
                    {
                      borderColor: seats === n ? c.primary : c.border,
                      backgroundColor: seats === n ? c.primaryLight : c.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.seatBtnText,
                      { color: seats === n ? c.primary : c.textSec },
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Passenger Details */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {/* Section header */}
            <View style={styles.passengerHeader}>
              <View style={[styles.passIconBox, { backgroundColor: c.primaryLight }]}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill={c.primary}>
                  <Path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </Svg>
              </View>
              <Text style={[styles.cardTitle, { color: c.text, marginBottom: 0 }]}>Passenger Details</Text>
              <View style={[styles.seatsBadge, { backgroundColor: c.primaryLight }]}>
                <Text style={[styles.seatsBadgeText, { color: c.primary }]}>
                  {seats} seat{seats > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Passenger cards */}
            <View style={styles.passengersCol}>
              {Array.from({ length: seats }).map((_, idx) => {
                const p = passengers[idx];
                const isFirst = idx === 0;
                return (
                  <View
                    key={idx}
                    style={[styles.passengerCard, { borderColor: c.border, backgroundColor: c.bg }]}
                  >
                    {/* Seat badge row */}
                    <View style={[styles.passengerBadgeRow, { backgroundColor: isFirst ? c.primaryLight : c.surfaceVariant, borderBottomColor: c.border }]}>
                      <View style={[styles.seatNumBox, { backgroundColor: isFirst ? c.primary : c.textSec }]}>
                        <Text style={styles.seatNumText}>{idx + 1}</Text>
                      </View>
                      <Text style={[styles.passengerLabel, { color: isFirst ? c.primary : c.textSec }]}>
                        {isFirst ? 'Primary Passenger (You)' : `Passenger ${idx + 1}`}
                      </Text>
                      {p.gender ? (
                        <Text style={styles.genderEmoji}>{GENDER_ICONS[p.gender as Gender]}</Text>
                      ) : null}
                    </View>

                    <View style={styles.passengerFields}>
                      {/* Name */}
                      <View>
                        <Text style={[styles.fieldLabel, { color: c.textSec }]}>FULL NAME</Text>
                        <TextInput
                          value={p.name}
                          onChangeText={text => updatePassenger(idx, 'name', text)}
                          placeholder="Enter full name"
                          placeholderTextColor={c.textDisabled}
                          editable={!isFirst}
                          style={[
                            styles.nameInput,
                            {
                              borderColor: p.name ? c.primary + '60' : c.border,
                              backgroundColor: isFirst ? c.surfaceVariant : c.surface,
                              color: c.text,
                            },
                          ]}
                        />
                      </View>

                      {/* Gender */}
                      <View>
                        <Text style={[styles.fieldLabel, { color: c.textSec }]}>GENDER</Text>
                        <View style={styles.genderRow}>
                          {GENDERS.map(g => (
                            <TouchableOpacity
                              key={g}
                              activeOpacity={isFirst ? 1 : 0.7}
                              disabled={isFirst}
                              onPress={() => updatePassenger(idx, 'gender', g)}
                              style={[
                                styles.genderBtn,
                                {
                                  borderColor: p.gender === g ? c.primary : c.border,
                                  backgroundColor: p.gender === g ? c.primaryLight : (isFirst ? c.surfaceVariant : c.surface),
                                },
                              ]}
                            >
                              <Text style={styles.genderBtnEmoji}>{GENDER_ICONS[g]}</Text>
                              <Text
                                style={[
                                  styles.genderBtnLabel,
                                  {
                                    color: p.gender === g ? c.primary : c.textSec,
                                    fontWeight: p.gender === g ? Typography.bold : Typography.medium,
                                  },
                                ]}
                              >
                                {g}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Message to Driver */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Message to Driver (optional)</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="e.g. I'll be waiting near the gate..."
              placeholderTextColor={c.textDisabled}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={[
                styles.messageInput,
                { backgroundColor: c.bg, borderColor: c.border, color: c.text },
              ]}
            />
          </View>

          {/* Fare Breakdown */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Fare Breakdown</Text>
            <View style={styles.fareRows}>
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, { color: c.textSec }]}>
                  Ride fare × {seats} seat{seats > 1 ? 's' : ''}
                </Text>
                <Text style={[styles.fareValue, { color: c.text }]}>₹{seats * pricePerSeat}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, { color: c.textSec }]}>Platform fee (10%)</Text>
                <Text style={[styles.fareValue, { color: c.text }]}>₹{platformFee}</Text>
              </View>
              <View style={[styles.fareDivider, { backgroundColor: c.border }]} />
              <View style={styles.fareRow}>
                <Text style={[styles.totalLabel, { color: c.text }]}>Total</Text>
                <Text style={[styles.totalValue, { color: c.primary }]}>₹{total}</Text>
              </View>
            </View>
          </View>

          {/* Cancellation Policy */}
          <View style={[styles.policyBox, { backgroundColor: c.primaryLight }]}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill={c.primary} style={styles.warnIcon}>
              <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </Svg>
            <Text style={[styles.policyText, { color: c.primary }]}>
              <Text style={styles.bold}>Free cancellation</Text> up to 2 hours before departure. ₹20 fee after that.
            </Text>
          </View>
        </ScrollView>

        {/* ── Sticky CTA ──────────────────────────────────────────── */}
        <View style={[styles.ctaBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          {!passengersFilled && (
            <Text style={[styles.ctaWarning, { color: c.warning }]}>
              ⚠️ Please fill in all passenger names & genders
            </Text>
          )}
          <AnimatedPressable
            scaleValue={0.97}
            disabled={!passengersFilled || isSubmitting}
            onPress={handleConfirm}
            style={styles.ctaPressable}
          >
            <LinearGradient
              colors={passengersFilled ? [c.primary, c.primaryDark] : [c.border, c.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.ctaButton,
                passengersFilled && Shadow.primary(c.primary),
              ]}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill={passengersFilled ? 'white' : c.textSec}>
                <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </Svg>
              <Text style={[styles.ctaText, { color: passengersFilled ? 'white' : c.textSec }]}>
                {isSubmitting ? 'Processing...' : `Confirm & Pay ₹${total}`}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  // ── Confirmed View ──────────────────────────────────────────────
  confirmedRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  confirmedCircle: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedTitle: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.bold,
  },
  confirmedSub: {
    fontSize: Typography.md,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: Typography.bold,
  },

  // ── Scroll Content ──────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },

  // ── Reusable Card ───────────────────────────────────────────────
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  cardTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    marginBottom: Spacing.md,
  },

  // ── Ride Summary ────────────────────────────────────────────────
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
  },
  driverName: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  driverMeta: {
    fontSize: Typography.base,
  },
  ratingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  ratingText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  routeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  routeLabel: {
    fontSize: Typography.sm,
  },
  routePlace: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  routeTime: {
    fontSize: Typography.base,
  },

  // ── Warning Box ─────────────────────────────────────────────────
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  warnIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  warningText: {
    flex: 1,
    fontSize: Typography.base,
    color: '#7A5200',
    lineHeight: 18,
  },
  bold: {
    fontWeight: Typography.bold,
  },

  // ── Seat Selector ───────────────────────────────────────────────
  seatRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  seatBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatBtnText: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },

  // ── Passenger Details ───────────────────────────────────────────
  passengerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  passIconBox: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatsBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  seatsBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  passengersCol: {
    gap: Spacing.md,
  },
  passengerCard: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  passengerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  seatNumBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatNumText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: 'white',
  },
  passengerLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    flex: 1,
  },
  genderEmoji: {
    fontSize: 16,
  },
  passengerFields: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: Typography.semibold,
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  nameInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  genderBtn: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  genderBtnEmoji: {
    fontSize: 13,
  },
  genderBtnLabel: {
    fontSize: Typography.sm,
  },

  // ── Message Input ───────────────────────────────────────────────
  messageInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.md,
    minHeight: 80,
  },

  // ── Fare Breakdown ──────────────────────────────────────────────
  fareRows: {
    gap: Spacing.sm,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fareLabel: {
    fontSize: Typography.md,
  },
  fareValue: {
    fontSize: Typography.md,
  },
  fareDivider: {
    height: 1,
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  totalValue: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.extrabold,
  },

  // ── Policy Box ──────────────────────────────────────────────────
  policyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  policyText: {
    flex: 1,
    fontSize: Typography.sm,
    lineHeight: 18,
  },

  // ── Sticky CTA ──────────────────────────────────────────────────
  ctaBar: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  ctaWarning: {
    fontSize: Typography.sm,
    textAlign: 'center',
    marginBottom: Spacing.sm,
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
});
