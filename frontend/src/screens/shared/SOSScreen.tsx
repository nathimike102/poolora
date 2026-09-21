import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from 'react-native';
import * as Location from 'expo-location';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { Icon } from '../../components/Icon';
import { bookingService } from '../../services/bookingService';
import { safetyService, type EmergencyContact, type SOSResponse } from '../../services/safetyService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CIRCUMFERENCE = 2 * Math.PI * 78;
/** India's single emergency number (police, fire, ambulance). */
const EMERGENCY_NUMBER = '112';
const LOCATION_UPDATE_MS = 15_000;

type Phase = 'idle' | 'holding' | 'countdown' | 'sending' | 'active' | 'failed';

async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** SOS is tied to a confirmed booking so the safety team knows the ride, driver and rider. */
async function findActiveBookingId(): Promise<string | null> {
  const [asRider, asDriver] = await Promise.all([
    bookingService.getRiderBookings(1, 1, 'confirmed').catch(() => null),
    bookingService.getDriverBookings(1, 1, 'confirmed').catch(() => null),
  ]);
  return asRider?.data?.items?.[0]?._id ?? asDriver?.data?.items?.[0]?._id ?? null;
}

function callEmergency() {
  Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
}

export function SOSScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('idle');
  const [holdProgress, setHoldProgress] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null | undefined>(undefined);
  const [emergency, setEmergency] = useState<SOSResponse | null>(null);
  const [failure, setFailure] = useState('');
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    safetyService.getEmergencyContacts().then(setContacts).catch(() => setContacts([]));
    findActiveBookingId().then(setActiveBookingId);
  }, []);

  useEffect(() => {
    if (phase === 'active') {
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.05, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
      );
    }
  }, [phase, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startHold = () => {
    if (phase !== 'idle' || !activeBookingId) return;
    setPhase('holding');
    let progress = 0;
    holdInterval.current = setInterval(() => {
      progress += 2;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdInterval.current!);
        setPhase('countdown');
      }
    }, 60);
  };

  const endHold = () => {
    if (phase === 'holding') {
      clearInterval(holdInterval.current!);
      setHoldProgress(0);
      setPhase('idle');
    }
  };

  const raiseSOS = useCallback(async () => {
    if (!activeBookingId) return;
    setPhase('sending');
    const location = await getCurrentLocation();
    if (!location) {
      setFailure('We could not get your location, so the alert was not sent. Call 112 now.');
      setPhase('failed');
      return;
    }
    try {
      const record = await safetyService.triggerSOS(activeBookingId, location);
      setEmergency(record);
      setPhase('active');
    } catch {
      setFailure('The alert could not reach Poolora. Check your connection and call 112 now.');
      setPhase('failed');
    }
  }, [activeBookingId]);

  // Countdown gives a few seconds to cancel an accidental trigger
  useEffect(() => {
    if (phase !== 'countdown') return;
    const interval = setInterval(() => {
      setCountdown(t => {
        if (t <= 1) {
          clearInterval(interval);
          raiseSOS();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, raiseSOS]);

  // Keep the safety team's view of the location current while the alert is active
  useEffect(() => {
    if (phase !== 'active' || !emergency) return;
    const interval = setInterval(async () => {
      const location = await getCurrentLocation();
      if (location) safetyService.updateSOSLocation(emergency._id, location).catch(() => undefined);
    }, LOCATION_UPDATE_MS);
    return () => clearInterval(interval);
  }, [phase, emergency]);

  const markSafe = async () => {
    if (emergency) {
      try {
        await safetyService.updateSOSCheckIn(emergency._id, 'ok', 'User confirmed safe from the app');
      } catch {
        Alert.alert(
          'Could not close the alert',
          'Your alert is still active. Check your connection and try again.',
        );
        return;
      }
    }
    setPhase('idle');
    setCountdown(10);
    setHoldProgress(0);
    setEmergency(null);
    navigation.goBack();
  };

  const shareLocation = async () => {
    const location = await getCurrentLocation();
    if (!location) {
      Alert.alert('Location unavailable', 'Allow location access to share where you are.');
      return;
    }
    Share.share({
      message: `My current location: https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`,
    });
  };

  /* ═══════════════════  ACTIVE / SENDING / FAILED  ═══════════════════ */
  if (phase === 'active' || phase === 'sending' || phase === 'failed') {
    const notified = emergency?.emergencyContactsNotified ?? [];
    return (
      <View style={[s.root, { backgroundColor: '#B71C1C', paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={s.activeBody}>
          {phase === 'sending' ? (
            <>
              <ActivityIndicator size="large" color="white" />
              <Text style={s.activeTitle} accessibilityLiveRegion="assertive">Sending SOS alert</Text>
            </>
          ) : phase === 'failed' ? (
            <>
              <Icon name="alert-circle" size={54} color="white" />
              <Text style={s.activeTitle} accessibilityLiveRegion="assertive">SOS not sent</Text>
              <Text style={s.activeSub}>{failure}</Text>
            </>
          ) : (
            <>
              <ReAnimated.View style={[s.activeCircle, pulseStyle]}>
                <Icon name="alert" size={54} color="white" />
              </ReAnimated.View>
              <Text style={s.activeTitle} accessibilityLiveRegion="assertive">SOS alert active</Text>
              <Text style={s.activeSub}>
                The Poolora safety team has been alerted and can see your location.
              </Text>

              <View style={s.sharingCard}>
                {notified.length > 0 ? (
                  <>
                    <Text style={s.cardTitle}>Text message with your live location sent to:</Text>
                    {notified.map(contact => (
                      <View key={contact.phone} style={s.contactDot}>
                        <View style={s.greenDot} />
                        <Text style={s.cardText}>{contact.name}</Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={s.cardText}>
                    We could not text your emergency contacts. Call them directly if you can.
                  </Text>
                )}
              </View>
            </>
          )}

          <Pressable
            style={s.callBtn}
            onPress={callEmergency}
            accessibilityRole="button"
            accessibilityLabel="Call 112 emergency services"
          >
            <Icon name="phone" size={24} color="#B71C1C" />
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#B71C1C' }}>Call 112</Text>
          </Pressable>

          {phase === 'active' && (
            <Pressable onPress={markSafe} style={s.safeBtn} accessibilityRole="button">
              <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>I'm safe, close the alert</Text>
            </Pressable>
          )}
          {phase === 'failed' && (
            <View style={s.failedActions}>
              <Pressable onPress={raiseSOS} style={s.safeBtn} accessibilityRole="button">
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Try sending again</Text>
              </Pressable>
              <Pressable onPress={markSafe} style={s.cancelRow} accessibilityRole="button">
                <Text style={{ fontSize: 14, color: 'white', textDecorationLine: 'underline' }}>Close</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  /* ═══════════════════  IDLE / HOLDING / COUNTDOWN  ═══════════════════ */
  const isCountdown = phase === 'countdown';
  const canRaise = Boolean(activeBookingId);

  return (
    <View style={[s.root, { backgroundColor: isCountdown ? '#B71C1C' : c.bg, paddingTop: insets.top }]}>
      <View
        style={[
          s.header,
          {
            backgroundColor: isCountdown ? '#B71C1C' : c.surface,
            borderBottomColor: isCountdown ? '#B71C1C' : c.border,
          },
        ]}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <Text
          accessibilityRole="header"
          style={{ fontSize: 18, fontWeight: '700', color: isCountdown ? 'white' : c.text }}
        >
          Safety and SOS
        </Text>
      </View>

      {isCountdown ? (
        <View style={s.countdownBody}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: 'white' }} accessibilityLiveRegion="assertive">
            Sending SOS in {countdown} seconds
          </Text>
          <View style={s.countdownCircle}>
            <Text style={{ fontSize: 56, fontWeight: '800', color: 'white' }}>{countdown}</Text>
          </View>
          <Pressable
            onPress={() => { setPhase('idle'); setCountdown(10); setHoldProgress(0); }}
            style={s.cancelBtnOutline}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={s.flex1} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <View style={s.sosSection}>
            <Pressable
              onPressIn={startHold}
              onPressOut={endHold}
              disabled={!canRaise}
              accessibilityRole="button"
              accessibilityLabel="SOS. Press and hold for 3 seconds to alert the safety team and your emergency contacts"
              accessibilityState={{ disabled: !canRaise }}
              style={[s.sosBtn, !canRaise && { opacity: 0.4 }, { elevation: phase === 'holding' ? 16 : 8 }]}
            >
              <Svg width={170} height={170} style={{ position: 'absolute', top: -10, left: -10 }}>
                <Circle cx={85} cy={85} r={78} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={4} />
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
              <Icon name="alert" size={44} color="white" />
              <Text style={s.sosLabel}>SOS</Text>
            </Pressable>
            <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center' }}>
              {activeBookingId === undefined
                ? 'Checking for an active ride'
                : !canRaise
                  ? 'SOS alerts work during a confirmed ride. If you are in danger now, call 112.'
                  : phase === 'holding'
                    ? 'Keep holding'
                    : 'Press and hold for 3 seconds to alert the safety team and your emergency contacts'}
            </Text>
          </View>

          <View>
            <View style={s.sectionHeader}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Emergency contacts</Text>
              <Pressable
                onPress={() => navigation.navigate('EmergencyContacts')}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Manage</Text>
              </Pressable>
            </View>

            <View style={[s.contactsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              {contacts === null ? (
                <ActivityIndicator style={{ padding: 16 }} color={c.primary} />
              ) : contacts.length === 0 ? (
                <View style={s.contactRow}>
                  <Text style={{ flex: 1, fontSize: 14, color: c.textSec }}>
                    Add people who should get a text with your location if you raise an SOS.
                  </Text>
                </View>
              ) : (
                contacts.map((contact, i) => (
                  <View key={contact.phone}>
                    {i > 0 && <View style={[s.divider, { backgroundColor: c.border }]} />}
                    <View style={s.contactRow}>
                      <View style={[s.contactIcon, { backgroundColor: c.primaryLight }]}>
                        <Icon name="account" size={22} color={c.primary} />
                      </View>
                      <View style={s.flex1}>
                        <View style={s.contactNameRow}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{contact.name}</Text>
                          {contact.relation ? (
                            <View style={[s.relationBadge, { backgroundColor: c.bg }]}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: c.textSec }}>
                                {contact.relation}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ fontSize: 13, color: c.textSec }}>{contact.phone}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={s.quickRow}>
            <Pressable
              onPress={callEmergency}
              style={[s.quickBtn, { backgroundColor: c.errorLight }]}
              accessibilityRole="button"
              accessibilityLabel="Call 112 emergency services"
            >
              <Icon name="phone" size={24} color={c.error} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.error }}>Call 112</Text>
            </Pressable>
            <Pressable
              onPress={shareLocation}
              style={[s.quickBtn, { backgroundColor: c.primaryLight }]}
              accessibilityRole="button"
            >
              <Icon name="map-marker" size={24} color={c.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Share location</Text>
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
  activeBody: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 24, paddingVertical: 32 },
  activeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitle: { fontSize: 28, fontWeight: '800', color: 'white', textAlign: 'center' },
  activeSub: { fontSize: 15, color: 'white', textAlign: 'center', lineHeight: 22 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: 'white', marginBottom: 10 },
  cardText: { fontSize: 14, color: 'white', lineHeight: 20 },
  safeBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  failedActions: { width: '100%', alignItems: 'center', gap: 16 },
  sharingCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
  },
  contactDot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E676' },
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
  relationBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
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
