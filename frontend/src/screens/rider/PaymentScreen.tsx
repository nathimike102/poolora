import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PayRoute = RouteProp<RootStackParamList, 'Payment'>;
type PayState = 'pending' | 'processing' | 'success' | 'failure' | 'timeout';

/* ── Helpers ────────────────────────────────────────────────────── */
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

/* ── Spinner (replaces rotating div) ────────────────────────────── */
const Spinner = ({ color, borderColor, size = 60 }: { color: string; borderColor: string; size?: number }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ).start();
  }, [rotation]);
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 4,
        borderColor,
        borderTopColor: color,
        transform: [{ rotate }],
      }}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
export function PaymentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<PayRoute>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const total = route.params?.amount ?? 198;

  const [payState, setPayState] = useState<PayState>('pending');
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'wallet'>('upi');
  const [upiId, setUpiId] = useState('');
  const [timeLeft, setTimeLeft] = useState(900);

  /* Countdown timer */
  useEffect(() => {
    if (payState !== 'pending') return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          setPayState('timeout');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [payState]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const isNearExpiry = timeLeft < 120;

  const handlePay = () => {
    setPayState('processing');
    setTimeout(() => setPayState('success'), 2000);
  };

  /* Success scale animation */
  const successScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (payState === 'success') {
      successScale.setValue(0);
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
    }
  }, [payState, successScale]);

  /* ── Processing state ───────────────────────────────────────────── */
  if (payState === 'processing') {
    return (
      <View style={[styles.fullCenter, { backgroundColor: c.bg }]}>
        <Spinner color={c.primary} borderColor={c.border} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginTop: 20 }}>
          Processing Payment...
        </Text>
        <Text style={{ fontSize: 14, color: c.textSec, marginTop: 8 }}>
          Please don't close this screen
        </Text>
      </View>
    );
  }

  /* ── Success state ──────────────────────────────────────────────── */
  if (payState === 'success') {
    return (
      <View style={[styles.fullCenter, { backgroundColor: c.bg, paddingHorizontal: 24 }]}>
        <Animated.View style={{ transform: [{ scale: successScale }] }}>
          <LinearGradient
            colors={[c.success, '#00952A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.successCircle}
          >
            <Svg width={44} height={44} viewBox="0 0 24 24">
              <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white" />
            </Svg>
          </LinearGradient>
        </Animated.View>

        <Text style={{ fontSize: 24, fontWeight: '800', color: c.text, marginTop: 20 }}>
          Payment Successful!
        </Text>
        <Text style={{ fontSize: 32, fontWeight: '800', color: c.success, marginVertical: 8 }}>
          ₹{total}
        </Text>
        <Text style={{ fontSize: 14, color: c.textSec }}>Booking ID: #RP2402847</Text>

        {/* Receipt card */}
        <View style={[styles.receiptCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          {([
            { label: 'Ride', value: 'Koramangala → MG Road' },
            { label: 'Driver', value: 'Rajesh Kumar' },
            { label: 'Date & Time', value: 'Today · 9:00 AM' },
          ] as const).map((row, i) => (
            <View key={i} style={[styles.receiptRow, i < 2 && { marginBottom: 8 }]}>
              <Text style={{ fontSize: 14, color: c.textSec }}>{row.label}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{row.value}</Text>
            </View>
          ))}
        </View>

        <AnimatedPressable onPress={() => navigation.navigate('ActiveRide', { rideId: route.params?.rideId ?? 'ride_1' })} style={{ width: '100%' }}>
          <LinearGradient
            colors={[c.primary, '#0D47A1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bigCta}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>Track My Ride</Text>
          </LinearGradient>
        </AnimatedPressable>

        <Pressable onPress={() => navigation.navigate('RiderTabs' as any)} style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, color: c.textSec }}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  /* ── Failure state ──────────────────────────────────────────────── */
  if (payState === 'failure') {
    return (
      <View style={[styles.fullCenter, { backgroundColor: c.bg, paddingHorizontal: 24 }]}>
        <View style={[styles.statusCircle, { backgroundColor: c.errorLight }]}>
          <Svg width={40} height={40} viewBox="0 0 24 24">
            <Path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              fill={c.error}
            />
          </Svg>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: c.text, marginTop: 20 }}>
          Payment Failed
        </Text>
        <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center', marginTop: 8 }}>
          Your payment could not be processed. No amount was deducted.
        </Text>
        <AnimatedPressable onPress={() => setPayState('pending')} style={{ width: '100%', marginTop: 24 }}>
          <View style={[styles.solidCta, { backgroundColor: c.primary }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Try Again</Text>
          </View>
        </AnimatedPressable>
      </View>
    );
  }

  /* ── Timeout state ──────────────────────────────────────────────── */
  if (payState === 'timeout') {
    return (
      <View style={[styles.fullCenter, { backgroundColor: c.bg, paddingHorizontal: 24 }]}>
        <View style={[styles.statusCircle, { backgroundColor: c.warningLight }]}>
          <Svg width={40} height={40} viewBox="0 0 24 24">
            <Path
              d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm4.3 14.3L11 11V6h1.5v4.4l4.8 4.8-1 1.1z"
              fill={c.warning}
            />
          </Svg>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: c.text, marginTop: 20 }}>
          Session Expired
        </Text>
        <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center', marginTop: 8 }}>
          Payment window expired. Please restart the booking.
        </Text>
        <AnimatedPressable onPress={() => navigation.navigate('RiderTabs' as any)} style={{ width: '100%', marginTop: 24 }}>
          <View style={[styles.solidCta, { backgroundColor: c.primary }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Start Over</Text>
          </View>
        </AnimatedPressable>
      </View>
    );
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* ── Pending (main) state ───────────────────────────────────────── */
  const methods = [
    { id: 'upi' as const, label: 'UPI', sub: 'GPay, PhonePe, Paytm', icon: '📱' },
    { id: 'card' as const, label: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay', icon: '💳' },
    { id: 'wallet' as const, label: 'Wallet', sub: 'Sanchari Cash · ₹0', icon: '👜' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <AnimatedPressable onPress={() => navigation.goBack()}>
          <View style={[styles.backBtn, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 5l-7 7 7 7" stroke={c.text} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </View>
        </AnimatedPressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Payment</Text>

        {/* Timer */}
        <View style={[styles.timerBadge, { backgroundColor: isNearExpiry ? c.errorLight : c.warningLight }]}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
              fill={isNearExpiry ? c.error : c.warning}
            />
          </Svg>
          <Text style={{ fontSize: 14, fontWeight: '700', color: isNearExpiry ? c.error : c.warning, marginLeft: 4 }}>
            {formatTime(timeLeft)}
          </Text>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Fare card */}
        <LinearGradient
          colors={[c.primary, c.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fareCard}
        >
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
            TOTAL AMOUNT
          </Text>
          <Text style={{ fontSize: 36, fontWeight: '800', color: 'white' }}>₹{total}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>
            Koramangala → MG Road · 1 seat
          </Text>
        </LinearGradient>

        {/* Payment methods */}
        <View style={[styles.methodsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, padding: 16, paddingBottom: 10 }}>
            Payment Method
          </Text>
          {methods.map((m, i) => (
            <View key={m.id}>
              {i > 0 && <View style={[styles.methodDivider, { backgroundColor: c.border }]} />}
              <Pressable
                onPress={() => setSelectedMethod(m.id)}
                style={styles.methodRow}
              >
                <View style={[styles.methodIcon, { backgroundColor: c.bg }]}>
                  <Text style={{ fontSize: 22 }}>{m.icon}</Text>
                </View>
                <View style={styles.flex1}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{m.label}</Text>
                  <Text style={{ fontSize: 12, color: c.textSec }}>{m.sub}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: selectedMethod === m.id ? c.primary : c.border,
                      backgroundColor: selectedMethod === m.id ? c.primary : 'transparent',
                    },
                  ]}
                >
                  {selectedMethod === m.id && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            </View>
          ))}
        </View>

        {/* UPI input */}
        {selectedMethod === 'upi' && (
          <View style={[styles.upiCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 }}>
              UPI ID
            </Text>
            <TextInput
              value={upiId}
              onChangeText={setUpiId}
              placeholder="yourname@upi"
              placeholderTextColor={c.textSec}
              style={[
                styles.upiInput,
                { borderColor: c.border, backgroundColor: c.bg, color: c.text },
              ]}
            />
            <View style={styles.upiApps}>
              {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
                <Pressable
                  key={app}
                  style={[styles.upiChip, { backgroundColor: c.bg, borderColor: c.border }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: c.textSec }}>{app}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Security note */}
        <View style={styles.securityRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
              fill={c.success}
            />
          </Svg>
          <Text style={{ fontSize: 12, color: c.textSec, marginLeft: 6 }}>
            256-bit SSL secured · RBI compliant
          </Text>
        </View>
      </ScrollView>

      {/* ── Pay button bar ──────────────────────────────────────── */}
      <View style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <AnimatedPressable onPress={handlePay} style={{ width: '100%' }}>
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.payBtn}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"
                fill="white"
              />
            </Svg>
            <Text style={{ fontSize: 16, fontWeight: '700', color: 'white', marginLeft: 8 }}>
              Pay ₹{total}
            </Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Full-screen states */
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },

  successCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCard: {
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 20,
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bigCta: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidCta: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.lg,
    marginLeft: 'auto',
  },

  /* Content */
  scrollContent: { padding: 20, gap: 16, paddingBottom: 16 },

  /* Fare card */
  fareCard: { borderRadius: 16, padding: 20 },

  /* Methods */
  methodsCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  methodDivider: { height: 1, marginLeft: 16 },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'white' },

  /* UPI */
  upiCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  upiInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  upiApps: { flexDirection: 'row', gap: 8, marginTop: 12 },
  upiChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },

  /* Security */
  securityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  /* Bottom */
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  payBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
