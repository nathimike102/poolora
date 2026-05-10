import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CIRCUMFERENCE = 2 * Math.PI * 78;

const EMERGENCY_CONTACTS = [
  { name: 'Mom', phone: '+91 98765 43210', relation: 'Primary', verified: true },
  { name: 'Dad', phone: '+91 87654 32109', relation: 'Secondary', verified: true },
  { name: 'Rohan (Friend)', phone: '+91 76543 21098', relation: 'Emergency', verified: false },
];

export function SOSScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<'idle' | 'holding' | 'countdown' | 'active'>('idle');
  const [holdProgress, setHoldProgress] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing animation for active phase
  const pulseScale = useSharedValue(1);
  const blinkOpacity = useSharedValue(1);

  useEffect(() => {
    if (phase === 'active') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
      );
      blinkOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 400 }),
          withTiming(1, { duration: 400 }),
        ),
        -1,
      );
    }
  }, [phase, pulseScale, blinkOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const blinkStyle = useAnimatedStyle(() => ({
    opacity: blinkOpacity.value,
  }));

  const startHold = () => {
    if (phase !== 'idle') return;
    setPhase('holding');
    let progress = 0;
    holdInterval.current = setInterval(() => {
      progress += 2;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdInterval.current!);
        setPhase('countdown');
      }
    }, 100);
  };

  const endHold = () => {
    if (phase === 'holding') {
      clearInterval(holdInterval.current!);
      setHoldProgress(0);
      setPhase('idle');
    }
  };

  useEffect(() => {
    if (phase === 'countdown') {
      const interval = setInterval(() => {
        setCountdown(t => {
          if (t <= 1) {
            clearInterval(interval);
            setPhase('active');
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const resetAll = () => {
    setPhase('idle');
    setCountdown(10);
    setHoldProgress(0);
  };

  /* ═══════════════════  ACTIVE PHASE  ═══════════════════ */
  if (phase === 'active') {
    return (
      <View style={[s.root, { backgroundColor: '#E53935', paddingTop: insets.top }]}>
        <View style={s.activeBody}>
          {/* Pulsing icon */}
          <ReAnimated.View
            style={[s.activeCircle, pulseStyle]}
          >
            <Svg width={54} height={54} viewBox="0 0 24 24">
              <Path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                fill="white"
              />
            </Svg>
          </ReAnimated.View>

          <Text style={s.activeTitle}>SOS ACTIVATED</Text>
          <Text style={s.activeSub}>Emergency contacts notified · Live location shared</Text>

          {/* Sharing card */}
          <View style={s.sharingCard}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'white', marginBottom: 10 }}>
              📍 Your live location is being shared with:
            </Text>
            {['Mom (Primary)', 'Dad', 'Sanchari Safety Team'].map(name => (
              <View key={name} style={s.contactDot}>
                <View style={s.greenDot} />
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>{name}</Text>
              </View>
            ))}
          </View>

          {/* Admin monitor */}
          <View style={s.monitorCard}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
              Admin monitoring status
            </Text>
            <View style={s.monitorRow}>
              <ReAnimated.View style={[s.blinkDot, blinkStyle]} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: 'white' }}>
                Sanchari Safety Team Active
              </Text>
            </View>
          </View>

          {/* Call police */}
          <Pressable style={s.callBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path
                d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                fill="#E53935"
              />
            </Svg>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#E53935' }}>Call Police · 100</Text>
          </Pressable>

          {/* Cancel */}
          <Pressable
            onPress={() => { resetAll(); navigation.goBack(); }}
            style={s.cancelRow}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                fill="rgba(255,255,255,0.6)"
              />
            </Svg>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Resolved — Cancel SOS</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ═══════════════════  IDLE / HOLDING / COUNTDOWN  ═══════════════════ */
  const isCountdown = phase === 'countdown';

  return (
    <View style={[s.root, { backgroundColor: isCountdown ? '#E53935' : c.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View
        style={[
          s.header,
          {
            backgroundColor: isCountdown ? '#C62828' : c.surface,
            borderBottomColor: isCountdown ? '#C62828' : c.border,
          },
        ]}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: isCountdown ? 'white' : c.text }}>
          Safety & SOS
        </Text>
      </View>

      {isCountdown ? (
        /* ── Countdown ── */
        <View style={s.countdownBody}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: 'white' }}>SOS activating in...</Text>
          <View style={s.countdownCircle}>
            <Text style={{ fontSize: 56, fontWeight: '800', color: 'white' }}>{countdown}</Text>
          </View>
          <Pressable
            onPress={() => { setPhase('idle'); setCountdown(10); }}
            style={s.cancelBtnOutline}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>CANCEL</Text>
          </Pressable>
        </View>
      ) : (
        /* ── Idle / Holding ── */
        <ScrollView style={s.flex1} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {/* SOS button */}
          <View style={s.sosSection}>
            <Pressable
              onPressIn={startHold}
              onPressOut={endHold}
              style={[
                s.sosBtn,
                { elevation: phase === 'holding' ? 16 : 8 },
              ]}
            >
              {/* Progress ring */}
              <Svg
                width={170}
                height={170}
                style={{ position: 'absolute', top: -10, left: -10 }}
              >
                <Circle
                  cx={85}
                  cy={85}
                  r={78}
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={4}
                />
                <Circle
                  cx={85}
                  cy={85}
                  r={78}
                  fill="none"
                  stroke="white"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={`${CIRCUMFERENCE}`}
                  strokeDashoffset={`${CIRCUMFERENCE * (1 - holdProgress / 100)}`}
                  rotation={-90}
                  origin="85,85"
                />
              </Svg>
              <Svg width={44} height={44} viewBox="0 0 24 24" style={{ zIndex: 1 }}>
                <Path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                  fill="white"
                />
              </Svg>
              <Text style={s.sosLabel}>SOS</Text>
            </Pressable>
            <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center' }}>
              {phase === 'holding' ? 'Keep holding...' : 'Hold for 5 seconds to activate SOS'}
            </Text>
          </View>

          {/* Emergency contacts */}
          <View>
            <View style={s.sectionHeader}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Emergency Contacts</Text>
              <Pressable onPress={() => navigation.navigate('EmergencyContacts' as any)}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Manage</Text>
              </Pressable>
            </View>

            <View style={[s.contactsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              {EMERGENCY_CONTACTS.map((contact, i) => (
                <View key={contact.name}>
                  {i > 0 && <View style={[s.divider, { backgroundColor: c.border }]} />}
                  <View style={s.contactRow}>
                    <View style={[s.contactIcon, { backgroundColor: c.primaryLight }]}>
                      <Text style={{ fontSize: 22 }}>👤</Text>
                    </View>
                    <View style={s.flex1}>
                      <View style={s.contactNameRow}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{contact.name}</Text>
                        <View
                          style={[
                            s.relationBadge,
                            {
                              backgroundColor: contact.relation === 'Primary' ? c.successLight : c.bg,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color: contact.relation === 'Primary' ? c.success : c.textSec,
                            }}
                          >
                            {contact.relation}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, color: c.textSec }}>{contact.phone}</Text>
                    </View>
                    {contact.verified && (
                      <Svg width={18} height={18} viewBox="0 0 24 24">
                        <Path
                          d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
                          fill={c.success}
                        />
                      </Svg>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Quick actions */}
          <View style={s.quickRow}>
            <Pressable style={[s.quickBtn, { backgroundColor: c.errorLight }]}>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path
                  d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                  fill={c.error}
                />
              </Svg>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.error }}>Call 100</Text>
            </Pressable>
            <Pressable style={[s.quickBtn, { backgroundColor: c.warningLight }]}>
              <Text style={{ fontSize: 26 }}>📍</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.warning }}>Share Location</Text>
            </Pressable>
            <Pressable style={[s.quickBtn, { backgroundColor: c.primaryLight }]}>
              <Text style={{ fontSize: 26 }}>💬</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>Alert Contacts</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

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

  /* Body */
  body: { padding: 20, gap: 16, paddingBottom: 40 },

  /* SOS button */
  sosSection: { alignItems: 'center', paddingVertical: 24, gap: 20 },
  sosBtn: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  sosLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
    marginTop: 4,
    zIndex: 1,
  },

  /* Countdown */
  countdownBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 24 },
  countdownCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnOutline: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Active phase */
  activeBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 24 },
  activeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitle: { fontSize: 28, fontWeight: '800', color: 'white' },
  activeSub: { fontSize: 15, color: 'rgba(255,255,255,0.8)' },
  sharingCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
  },
  contactDot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E676' },
  monitorCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  monitorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  blinkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E676' },
  callBtn: {
    width: '100%',
    height: 60,
    borderRadius: 16,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  cancelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  /* Contacts */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  contactsCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  relationBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 20 },
  divider: { height: 1, marginLeft: 16 },

  /* Quick actions */
  quickRow: { flexDirection: 'row', gap: 12 },
  quickBtn: {
    flex: 1,
    height: 80,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
