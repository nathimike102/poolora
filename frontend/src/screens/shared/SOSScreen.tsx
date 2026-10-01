/**
 * SOSScreen.tsx
 *
 * The SOS flow (UC-R07). Holding the button for 3 seconds raises the alert
 * at once: the safety team is paged straight away. Emergency contacts are
 * texted after a short window (10 seconds) in which an accidental press can
 * be cancelled. Nothing waits for GPS: without a fix the server uses the
 * car's last position. With no connection the app keeps retrying, and offers
 * to text the contacts from the phone itself and to call the emergency line.
 *
 * An open SOS is loaded again whenever the screen opens, so leaving it never
 * loses the alert. "I'm safe" is passed on to the safety team, who confirm
 * and close it.
 */

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
  Platform,
  Share,
  Switch,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { Icon } from '../../components/Icon';
import { safetyService, type EmergencyContact, type SOSResponse, type SOSThreat } from '../../services/safetyService';
import { batteryLevel } from '../../utils/battery';
import { REGION } from '../../utils/region';
import { displayPhone } from '../../utils/phone';
import { initSocket } from '../../utils/socket';
import { errorHandler } from '../../utils/errorHandler';
import { startSosTracking, stopSosTracking } from '../../services/sosTracking';
import { setSosAudioEnabled, sosAudioEnabled, useSosRecording } from '../../services/sosAudio';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CIRCUMFERENCE = 2 * Math.PI * 78;
const HOLD_MS = 3000;
/** UC-R07: the position is sent every 5 seconds while the alert is open */
const LOCATION_UPDATE_MS = 5_000;
const STATUS_POLL_MS = 10_000;
const RETRY_MS = 5_000;
/** A fresh fix is worth waiting for only briefly; the last known one, or none, still sends the alert */
const FIX_TIMEOUT_MS = 4_000;

type Phase = 'loading' | 'idle' | 'holding' | 'sending' | 'active' | 'retrying';
type Position = { lat: number; lng: number };

const OPEN_STATUSES = ['triggered', 'acknowledged'];
const CONTACTS_CACHE_KEY = '@poolora_sos_contacts';
/** Below this, the screen says the contacts already have the last position */
const LOW_BATTERY = 0.15;

/** "What's happening?": optional, after the alert has gone */
const THREATS: Array<{ value: SOSThreat; label: string }> = [
  { value: 'driver', label: 'The driver' },
  { value: 'passenger', label: 'A passenger' },
  { value: 'outside', label: 'Someone outside the car' },
  { value: 'medical', label: 'Medical' },
  { value: 'accident', label: 'Accident' },
  { value: 'other', label: 'Something else' },
];

async function quickPosition(): Promise<Position | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(p => ({ lat: p.coords.latitude, lng: p.coords.longitude }))
      .catch(() => null);
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), FIX_TIMEOUT_MS));
    const fix = await Promise.race([fresh, timeout]);
    if (fix) return fix;
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    return last ? { lat: last.coords.latitude, lng: last.coords.longitude } : null;
  } catch {
    return null;
  }
}

function call(number: string) {
  Linking.openURL(`tel:${number}`);
}

/** Opens the phone's own messaging app, which works without mobile data */
async function textContactsFromPhone(contacts: EmergencyContact[]) {
  const numbers = contacts.filter(c => c.notifyOnSos !== false).map(c => c.phone);
  if (!numbers.length) {
    Alert.alert('No emergency contacts', `Call ${REGION.emergency.general} if you are in danger.`);
    return;
  }
  const position = await quickPosition();
  const where = position ? ` I am here: https://maps.google.com/?q=${position.lat},${position.lng}` : '';
  const body = encodeURIComponent(`SOS. I need help during a Poolora ride.${where}`);
  const list = numbers.join(',');
  Linking.openURL(Platform.OS === 'ios' ? `sms:${list}&body=${body}` : `sms:${list}?body=${body}`);
}

function secondsUntil(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

export function SOSScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'SOS'>>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('loading');
  const [holdProgress, setHoldProgress] = useState(0);
  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(route.params?.bookingId ?? null);
  const [emergency, setEmergency] = useState<SOSResponse | null>(null);
  const [windowLeft, setWindowLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [recordAudio, setRecordAudio] = useState(false);
  const [battery, setBattery] = useState<number | undefined>(undefined);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseScale = useSharedValue(1);

  const isClosed = Boolean(emergency && !OPEN_STATUSES.includes(emergency.status));

  // Resume an open SOS, else find the ride an SOS would be about
  useEffect(() => {
    sosAudioEnabled().then(setRecordAudio).catch(() => undefined);
    // Kept on the phone too, so they can be texted from it with no connection
    safetyService.getEmergencyContacts()
      .then(list => {
        setContacts(list);
        AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(list.map(({ name, phone, notifyOnSos }) => ({ name, phone, notifyOnSos })))).catch(() => undefined);
      })
      .catch(async () => {
        const cached = await AsyncStorage.getItem(CONTACTS_CACHE_KEY).catch(() => null);
        setContacts(cached ? (JSON.parse(cached) as EmergencyContact[]) : []);
      });
    safetyService.getCurrentSOS()
      .then(({ sos, bookingId: current }) => {
        if (sos) {
          setEmergency(sos);
          setBookingId(current);
          setPhase('active');
        } else {
          // Nothing open: make sure no tracking is left running from an earlier SOS
          stopSosTracking();
          setBookingId(b => b ?? current);
          setPhase('idle');
        }
      })
      .catch(() => setPhase('idle'));
    return () => {
      if (holdTimer.current) clearInterval(holdTimer.current);
    };
  }, []);

  useEffect(() => {
    if (phase === 'active' && !isClosed) {
      pulseScale.value = withRepeat(withSequence(withTiming(1.05, { duration: 500 }), withTiming(1, { duration: 500 })), -1);
    }
  }, [phase, isClosed, pulseScale]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  const raiseSOS = useCallback(async () => {
    if (!bookingId) return;
    setPhase('sending');
    const position = await quickPosition();
    try {
      const record = await safetyService.triggerSOS(bookingId, position);
      setEmergency(record);
      setPhase('active');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    } catch (error) {
      const { code, message } = errorHandler.process(error);
      if (code >= 400 && code < 500) {
        // Refused (the ride is no longer confirmed, say): retrying will not help
        Alert.alert('SOS not sent', `${message} Call ${REGION.emergency.general} if you are in danger.`);
        setPhase('idle');
        return;
      }
      setPhase('retrying');
    }
  }, [bookingId]);

  // No connection: keep trying on our own (UC-R07 5a)
  useEffect(() => {
    if (phase !== 'retrying') return;
    const timer = setTimeout(raiseSOS, RETRY_MS);
    return () => clearTimeout(timer);
  }, [phase, raiseSOS]);

  const startHold = () => {
    if (phase !== 'idle' || !bookingId) return;
    setPhase('holding');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const started = Date.now();
    holdTimer.current = setInterval(() => {
      const progress = Math.min(100, ((Date.now() - started) / HOLD_MS) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdTimer.current!);
        holdTimer.current = null;
        setHoldProgress(0);
        raiseSOS();
      }
    }, 50);
  };

  const endHold = () => {
    if (phase === 'holding' && holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
      setHoldProgress(0);
      setPhase('idle');
    }
  };

  const refresh = useCallback(async () => {
    if (!emergency) return;
    try {
      setEmergency(await safetyService.getSOSStatus(emergency._id));
    } catch {
      // Try again on the next tick
    }
  }, [emergency]);

  // While open: send the position, and follow what the safety team does.
  // The background task keeps sending with the screen off or the app closed;
  // if the phone will not run it, this screen sends while it is open.
  const open = phase === 'active' && Boolean(emergency) && !isClosed;
  useEffect(() => {
    if (!open || !emergency) return;
    const id = emergency._id;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    startSosTracking(id).then(started => {
      if (started || cancelled) return;
      timer = setInterval(async () => {
        const position = await quickPosition();
        if (position) safetyService.updateSOSLocation(id, position, await batteryLevel()).catch(() => undefined);
      }, LOCATION_UPDATE_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [open, emergency?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isClosed) stopSosTracking();
  }, [isClosed]);

  // A phone about to die: say so, so the person knows what still works
  useEffect(() => {
    if (!open) return;
    const check = () => batteryLevel().then(setBattery);
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [open]);

  const chooseThreat = async (threat: SOSThreat) => {
    if (!emergency) return;
    try {
      setEmergency(await safetyService.setSOSThreat(emergency._id, threat));
    } catch (error) {
      Alert.alert('Not sent', `${errorHandler.process(error).message} The safety team still has your alert.`);
    }
  };

  // Audio, only if the user switched it on (Safety settings below)
  useSosRecording(emergency?._id ?? null, open);

  const toggleAudio = async (on: boolean) => {
    const result = await setSosAudioEnabled(on);
    setRecordAudio(result);
    if (on && !result) Alert.alert('Microphone not allowed', 'Allow Poolora to use the microphone in your phone settings to record during an SOS.');
  };

  useEffect(() => {
    if (!open || !emergency) return;
    const socket = initSocket();
    const onUpdate = (data: { emergencyId: string }) => {
      if (data.emergencyId === emergency._id) refresh();
    };
    socket.on('sos:updated', onUpdate);
    const timer = setInterval(refresh, STATUS_POLL_MS);
    return () => {
      socket.off('sos:updated', onUpdate);
      clearInterval(timer);
    };
  }, [open, emergency?._id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // The cancel window before contacts are texted
  const pending = open && emergency?.contactsState === 'pending';
  useEffect(() => {
    if (!pending) return;
    setWindowLeft(secondsUntil(emergency?.contactsDueAt));
    const timer = setInterval(() => {
      const left = secondsUntil(emergency?.contactsDueAt);
      setWindowLeft(left);
      if (left === 0) {
        clearInterval(timer);
        setTimeout(refresh, 1500);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [pending, emergency?.contactsDueAt, refresh]);

  const cancelAccidental = async () => {
    if (!emergency) return;
    setBusy(true);
    try {
      setEmergency(await safetyService.cancelSOS(emergency._id));
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not cancel', errorHandler.process(error).message);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const sayImSafe = () => {
    if (!emergency) return;
    Alert.alert(
      'Tell the safety team you are safe?',
      'They will still call you to check, then close the alert. Your emergency contacts will be told you are safe.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: "I'm safe",
          onPress: async () => {
            setBusy(true);
            try {
              const updated = await safetyService.updateSOSCheckIn(emergency._id, 'ok', 'Said they are safe in the app');
              setEmergency(updated);
              if (!OPEN_STATUSES.includes(updated.status)) navigation.goBack();
            } catch (error) {
              Alert.alert('Not sent', `${errorHandler.process(error).message} Your alert is still active.`);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const reportDanger = async () => {
    if (!emergency) return;
    setBusy(true);
    try {
      setEmergency(await safetyService.updateSOSCheckIn(emergency._id, 'not_ok', 'Reported danger in the app'));
    } catch (error) {
      Alert.alert('Not sent', `${errorHandler.process(error).message} Call ${REGION.emergency.general} if you can.`);
    } finally {
      setBusy(false);
    }
  };

  const shareLocation = async () => {
    const position = await quickPosition();
    if (!position) {
      Alert.alert('Location unavailable', 'Allow location access to share where you are.');
      return;
    }
    Share.share({ message: `My current location: https://maps.google.com/?q=${position.lat},${position.lng}` });
  };

  const emergencyNumbers = (onRed: boolean) => (
    <View style={s.numbersRow}>
      {[
        ['Police', REGION.emergency.police],
        ['Ambulance', REGION.emergency.ambulance],
        ['Fire', REGION.emergency.fire],
      ].map(([label, number]) => (
        <Pressable
          key={label}
          onPress={() => call(number)}
          style={[s.numberBtn, onRed ? s.numberBtnOnRed : { backgroundColor: c.surface, borderColor: c.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Call ${label.toLowerCase()} on ${number}`}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: onRed ? 'white' : c.text }}>{number}</Text>
          <Text style={{ fontSize: 12, color: onRed ? 'white' : c.textSec }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );

  /* ═══════════════════  ACTIVE / SENDING / RETRYING  ═══════════════════ */
  if (phase === 'active' || phase === 'sending' || phase === 'retrying') {
    const notified = emergency?.emergencyContactsNotified ?? [];
    const acknowledged = emergency?.status === 'acknowledged';
    const safe = Boolean(emergency?.userSafeAt);
    let title = 'SOS alert active';
    let sub = 'The Poolora safety team has been alerted and can see where you are.';
    if (phase === 'sending') {
      title = 'Sending SOS';
      sub = '';
    } else if (phase === 'retrying') {
      title = 'Trying to reach Poolora';
      sub = `No connection yet. We keep trying every few seconds. Call ${REGION.emergency.general}, or text your contacts from your phone.`;
    } else if (isClosed) {
      title = 'SOS closed';
      sub = emergency?.cancelledAt ? 'You cancelled the alert. Your contacts were not told.' : 'The safety team has closed your alert.';
    } else if (safe) {
      sub = 'You said you are safe. The safety team will call you to check, then close the alert.';
    } else if (acknowledged) {
      sub = 'The safety team has your alert and will call you. Keep your phone with you.';
    }

    return (
      <View style={[s.root, { backgroundColor: isClosed ? c.bg : '#B71C1C', paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={s.activeBody}>
          {phase === 'sending' || phase === 'retrying' ? (
            <ActivityIndicator size="large" color="white" />
          ) : (
            <ReAnimated.View style={[s.activeCircle, !isClosed && pulseStyle]}>
              <Icon name={isClosed ? 'shield-check-outline' : 'alert'} size={54} color={isClosed ? c.primary : 'white'} />
            </ReAnimated.View>
          )}
          <Text style={[s.activeTitle, isClosed && { color: c.text }]} accessibilityRole="header" accessibilityLiveRegion="assertive">{title}</Text>
          {sub ? <Text style={[s.activeSub, isClosed && { color: c.textSec }]} accessibilityLiveRegion="polite">{sub}</Text> : null}

          {open ? (
            <View style={s.sharingCard}>
              {pending ? (
                <>
                  <Text style={s.cardTitle} accessibilityLiveRegion="polite">
                    Texting your emergency contacts in {windowLeft} s
                  </Text>
                  <Pressable onPress={cancelAccidental} disabled={busy} style={s.cancelBtn} accessibilityRole="button">
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#B71C1C' }}>Cancel, I pressed it by accident</Text>
                  </Pressable>
                </>
              ) : notified.length > 0 ? (
                <>
                  <Text style={s.cardTitle}>Text with your live location sent to:</Text>
                  {notified.map(contact => (
                    <View key={contact.phone} style={s.contactDot}>
                      <View style={s.greenDot} />
                      <Text style={s.cardText}>{contact.name}</Text>
                    </View>
                  ))}
                </>
              ) : emergency?.contactsState === 'none' ? (
                <Text style={s.cardText}>You have no emergency contacts to text. Add some after this so they can be told next time.</Text>
              ) : emergency?.contactsState === 'sending' ? (
                <Text style={s.cardText}>Texting your emergency contacts…</Text>
              ) : (
                <Text style={s.cardText}>We could not text your emergency contacts. Call them, or text them from your phone.</Text>
              )}
            </View>
          ) : null}

          {open && !emergency?.threat ? (
            <View style={s.sharingCard}>
              <Text style={s.cardTitle}>What's happening? (optional)</Text>
              <View style={s.threatRow}>
                {THREATS.map(t => (
                  <Pressable key={t.value} onPress={() => chooseThreat(t.value)} style={s.threatChip} accessibilityRole="button">
                    <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : open && emergency?.threat ? (
            <Text style={s.activeSub}>You told the safety team: {THREATS.find(t => t.value === emergency.threat)?.label.toLowerCase()}.</Text>
          ) : null}

          {open && battery !== undefined && battery < LOW_BATTERY ? (
            <Text style={[s.activeSub, { fontWeight: '700' }]} accessibilityLiveRegion="polite">
              Battery {Math.round(battery * 100)}%. If your phone dies, the safety team keeps your last position and can still see the other phones on the ride.
            </Text>
          ) : null}

          {!isClosed ? (
            <>
              <Pressable
                style={s.callBtn}
                onPress={() => call(REGION.emergency.general)}
                accessibilityRole="button"
                accessibilityLabel={`Call ${REGION.emergency.general} emergency services`}
              >
                <Icon name="phone" size={24} color="#B71C1C" />
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#B71C1C' }}>Call {REGION.emergency.general}</Text>
              </Pressable>
              {emergencyNumbers(true)}
              {phase === 'retrying' || (open && emergency?.contactsState !== 'sent' && !pending) ? (
                <Pressable onPress={() => textContactsFromPhone(contacts ?? [])} style={s.outlineBtn} accessibilityRole="button">
                  <Text style={s.outlineText}>Text my contacts from my phone</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {open && !pending ? (
            safe ? (
              <Pressable onPress={reportDanger} disabled={busy} style={s.outlineBtn} accessibilityRole="button">
                <Text style={s.outlineText}>I'm not safe after all</Text>
              </Pressable>
            ) : (
              <Pressable onPress={sayImSafe} disabled={busy} style={s.outlineBtn} accessibilityRole="button">
                <Text style={s.outlineText}>I'm safe now</Text>
              </Pressable>
            )
          ) : null}

          {phase === 'retrying' ? (
            <Pressable onPress={() => setPhase('idle')} style={s.linkRow} accessibilityRole="button">
              <Text style={{ fontSize: 14, color: 'white', textDecorationLine: 'underline' }}>Stop trying</Text>
            </Pressable>
          ) : null}
          {open ? (
            <Pressable onPress={() => navigation.goBack()} style={s.linkRow} accessibilityRole="button">
              <Text style={{ fontSize: 14, color: 'white', textDecorationLine: 'underline' }}>
                Leave this screen (the alert stays on)
              </Text>
            </Pressable>
          ) : null}
          {isClosed ? (
            <Pressable onPress={() => navigation.goBack()} style={[s.doneBtn, { backgroundColor: c.primary }]} accessibilityRole="button">
              <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Done</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  /* ═══════════════════  IDLE / HOLDING  ═══════════════════ */
  const canRaise = Boolean(bookingId);

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Safety and SOS</Text>
      </View>

      <ScrollView style={s.flex1} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.sosSection}>
          <Pressable
            onPressIn={startHold}
            onPressOut={endHold}
            disabled={!canRaise}
            accessibilityRole="button"
            accessibilityLabel="SOS. Press and hold for 3 seconds to alert the safety team"
            accessibilityHint="Your emergency contacts are texted 10 seconds later unless you cancel"
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
            {phase === 'loading'
              ? 'Checking for your current ride'
              : !canRaise
                ? `SOS alerts work during a confirmed ride. If you are in danger now, call ${REGION.emergency.general}.`
                : phase === 'holding'
                  ? 'Keep holding'
                  : 'Hold for 3 seconds. The safety team is alerted at once; your emergency contacts 10 seconds later, unless you cancel.'}
          </Text>
        </View>

        {!canRaise && phase !== 'loading' && (contacts?.length ?? 0) > 0 ? (
          <Pressable
            onPress={() => textContactsFromPhone(contacts ?? [])}
            style={[s.bigCall, { backgroundColor: c.primaryLight }]}
            accessibilityRole="button"
            accessibilityHint="Opens your messaging app with a message and your location; works without data"
          >
            <Icon name="message-alert-outline" size={22} color={c.primary} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.primary }}>Text my contacts from my phone</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => call(REGION.emergency.general)}
          style={[s.bigCall, { backgroundColor: c.errorLight }]}
          accessibilityRole="button"
          accessibilityLabel={`Call ${REGION.emergency.general} emergency services`}
        >
          <Icon name="phone" size={22} color={c.error} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.error }}>Call {REGION.emergency.general}</Text>
        </Pressable>
        {emergencyNumbers(false)}

        <View style={s.quickRow}>
          <Pressable onPress={shareLocation} style={[s.quickBtn, { backgroundColor: c.primaryLight }]} accessibilityRole="button">
            <Icon name="map-marker" size={24} color={c.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Share location</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FakeCall')} style={[s.quickBtn, { backgroundColor: c.primaryLight }]} accessibilityRole="button" accessibilityHint="Your phone rings in a few seconds, so you have a reason to leave">
            <Icon name="phone-incoming" size={24} color={c.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Fake call</Text>
          </Pressable>
        </View>

        <View style={[s.contactsCard, s.audioRow, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={s.flex1}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Record audio during an SOS</Text>
            <Text style={{ fontSize: 13, color: c.textSec, lineHeight: 19 }}>
              Off unless you switch it on. During an SOS your phone records what it hears and sends it to the Poolora safety team only, in parts of a minute.
            </Text>
          </View>
          <Switch value={recordAudio} onValueChange={toggleAudio} accessibilityLabel="Record audio during an SOS" trackColor={{ false: c.border, true: c.primary }} />
        </View>

        <View>
          <View style={s.sectionHeader}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Emergency contacts</Text>
            <Pressable onPress={() => navigation.navigate('EmergencyContacts')} accessibilityRole="button" hitSlop={8}>
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
                            <Text style={{ fontSize: 11, fontWeight: '700', color: c.textSec }}>{contact.relation}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ fontSize: 13, color: c.textSec }}>
                        {displayPhone(contact.phone) ?? contact.phone}
                        {contact.notifyOnSos === false ? ' · not texted on SOS' : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },

  body: { padding: 20, gap: 16, paddingBottom: 40 },

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
  sosLabel: { fontSize: 13, fontWeight: '700', color: 'white', marginTop: 4, zIndex: 1 },

  activeBody: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 32 },
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
  sharingCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16 },
  cancelBtn: { minHeight: 52, borderRadius: 14, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
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
  outlineBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  outlineText: { fontSize: 16, fontWeight: '700', color: 'white' },
  linkRow: { paddingVertical: 8 },
  doneBtn: { width: '100%', minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  numbersRow: { flexDirection: 'row', gap: 10, width: '100%' },
  numberBtn: { flex: 1, minHeight: 56, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  numberBtnOnRed: { borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.12)' },
  bigCall: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, borderRadius: 14 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  contactsCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  contactIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  relationBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
  divider: { height: 1, marginLeft: 16 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  threatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  threatChip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: 'white', justifyContent: 'center' },

  quickRow: { flexDirection: 'row', gap: 12 },
  quickBtn: { flex: 1, height: 80, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
