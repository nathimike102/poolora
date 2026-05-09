import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import { LiveMap } from '../../components/LiveMap';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TRACKING_STEPS = [
  { label: 'Parcel Booked', sub: 'Today, 8:00 AM', done: true, active: false },
  { label: 'Driver Picked Up', sub: 'Today, 9:10 AM · Koramangala', done: true, active: false },
  { label: 'In Transit', sub: 'ETA: ~22 min away', done: false, active: true },
  { label: 'Delivered', sub: 'Whitefield, ITPL Gate', done: false, active: false },
];

/* Pulsing dot for active step */
function PulsingDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'white',
        transform: [{ scale }],
      }}
    />
  );
}

export function ParcelTrackingScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Map ────────────────────────────────────────────── */}
      <View style={s.mapWrap}>
        <LiveMap />
        <View style={s.backOverlay}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
      </View>

      {/* ── Content ────────────────────────────────────────── */}
      <ScrollView style={s.flex1} contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Parcel info card */}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={s.idRow}>
            <Text style={{ fontSize: 12, color: c.textSec }}>PARCEL ID</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.text }}>#RP-PKG-20241</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={{ fontSize: 36 }}>📦</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Electronics Package</Text>
              <Text style={{ fontSize: 13, color: c.textSec }}>Koramangala → Whitefield · 0.8 kg</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: c.primaryLight }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>In Transit</Text>
            </View>
          </View>
        </View>

        {/* ETA card */}
        <LinearGradient
          colors={[c.primary, '#0D47A1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.etaCard}
        >
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>ESTIMATED DELIVERY</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: 'white' }}>~22 minutes</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Driver: Rajesh Kumar · KA 05 AB 1234</Text>
        </LinearGradient>

        {/* Tracking timeline */}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 14 }}>Tracking Timeline</Text>
          {TRACKING_STEPS.map((step, i) => (
            <View key={i} style={s.timelineRow}>
              <View style={s.timelineCol}>
                <View
                  style={[
                    s.timelineDot,
                    {
                      backgroundColor: step.done ? c.success : step.active ? c.primary : c.border,
                    },
                  ]}
                >
                  {step.done && (
                    <Svg width={11} height={11} viewBox="0 0 24 24">
                      <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="white" />
                    </Svg>
                  )}
                  {step.active && <PulsingDot />}
                </View>
                {i < TRACKING_STEPS.length - 1 && (
                  <View
                    style={[
                      s.timelineLine,
                      { backgroundColor: step.done ? c.success : c.border },
                    ]}
                  />
                )}
              </View>
              <View style={{ paddingBottom: i < TRACKING_STEPS.length - 1 ? 16 : 0 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: step.active || step.done ? '700' : '500',
                    color: step.active || step.done ? c.text : c.textSec,
                  }}
                >
                  {step.label}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: step.active ? c.primary : c.textSec,
                  }}
                >
                  {step.sub}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Delivery verification */}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 }}>Delivery Verification</Text>
          <Text style={{ fontSize: 13, color: c.textSec, marginBottom: 10 }}>
            Receiver must show OTP:{' '}
            <Text style={{ color: c.primary, fontSize: 18, fontWeight: '700' }}>4729</Text>
          </Text>
          <View style={[s.otpNote, { backgroundColor: c.primaryLight }]}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill={c.primary} />
            </Svg>
            <Text style={{ fontSize: 12, color: c.primary, flex: 1 }}>
              OTP verified delivery ensures your parcel reaches the right person.
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={s.actionsRow}>
          <Pressable style={[s.actionBtn, { backgroundColor: c.successLight }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                fill={c.success}
              />
            </Svg>
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.success }}>Call Driver</Text>
          </Pressable>
          <Pressable style={[s.actionBtn, { backgroundColor: c.primaryLight }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
                fill={c.primary}
              />
            </Svg>
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Share</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Map */
  mapWrap: { height: 200, position: 'relative' },
  backOverlay: { position: 'absolute', top: 16, left: 16 },

  scrollBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 16 },

  /* Card */
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },

  /* Parcel info */
  idRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },

  /* ETA */
  etaCard: { borderRadius: 16, padding: 16 },

  /* Timeline */
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  timelineCol: { alignItems: 'center' },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: { width: 2, height: 20, marginVertical: 3 },

  /* OTP */
  otpNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },

  /* Actions */
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
