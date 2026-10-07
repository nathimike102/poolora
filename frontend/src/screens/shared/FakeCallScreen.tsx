/**
 * FakeCallScreen.tsx
 *
 * A pretend incoming call (PRD: in-app safety tools), for a reason to step
 * away from someone or end a conversation. The user picks who "calls" and
 * how soon; the screen then goes quiet, and when the time comes it shows a
 * full-screen incoming call and vibrates like one. Answering shows a call in
 * progress with a running timer. Nothing is dialled and nobody is told.
 *
 * It vibrates rather than rings: the app ships no ringtone, and a phone on
 * silent vibrates anyway, which is what people around expect.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Vibration, StatusBar } from 'react-native';
import { Text, TextInput } from '../../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { tc } from '../../theme/themed';

type Phase = 'setup' | 'waiting' | 'ringing' | 'talking';

const DELAYS = [
  { seconds: 10, label: '10 s' },
  { seconds: 30, label: '30 s' },
  { seconds: 60, label: '1 min' },
  { seconds: 300, label: '5 min' },
];
/** Ring, pause, ring: roughly a phone's incoming-call pattern */
const RING_PATTERN = [0, 1000, 800];
/** A real call stops ringing after about half a minute */
const RING_FOR_MS = 30_000;

function clock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FakeCallScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [caller, setCaller] = useState(() => i18n.t('fakeCall.defaultCaller'));
  const [delay, setDelay] = useState(DELAYS[0].seconds);
  const [phase, setPhase] = useState<Phase>('setup');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'waiting') return;
    const timer = setTimeout(() => setPhase('ringing'), delay * 1000);
    return () => clearTimeout(timer);
  }, [phase, delay]);

  useEffect(() => {
    if (phase !== 'ringing') return;
    Vibration.vibrate(RING_PATTERN, true);
    const missed = setTimeout(() => setPhase('setup'), RING_FOR_MS);
    return () => {
      Vibration.cancel();
      clearTimeout(missed);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'talking') return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const name = caller.trim() || t('fakeCall.defaultCaller');

  if (phase === 'ringing' || phase === 'talking') {
    return (
      <View style={[s.callRoot, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 48 }]}>
        <StatusBar barStyle="light-content" />
        <View style={s.callerBlock}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.callerName} accessibilityRole="header">{name}</Text>
          <Text style={s.callerSub} accessibilityLiveRegion="polite">
            {phase === 'ringing' ? t('fakeCall.incoming') : clock(elapsed)}
          </Text>
        </View>
        {phase === 'ringing' ? (
          <View style={s.callButtons}>
            <Pressable onPress={() => setPhase('setup')} style={[s.round, { backgroundColor: '#E53935' }]} accessibilityRole="button" accessibilityLabel={t('fakeCall.decline')}>
              <Icon name="phone-hangup" size={32} color="white" />
            </Pressable>
            <Pressable onPress={() => setPhase('talking')} style={[s.round, { backgroundColor: '#2E7D32' }]} accessibilityRole="button" accessibilityLabel={t('fakeCall.answer')}>
              <Icon name="phone" size={32} color="white" />
            </Pressable>
          </View>
        ) : (
          <View style={s.callButtons}>
            <Pressable onPress={() => setPhase('setup')} style={[s.round, { backgroundColor: '#E53935' }]} accessibilityRole="button" accessibilityLabel={t('fakeCall.endCall')}>
              <Icon name="phone-hangup" size={32} color="white" />
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  if (phase === 'waiting') {
    // Deliberately plain, so a glance at the screen gives nothing away
    return (
      <Pressable style={[s.waitRoot, { paddingTop: insets.top }]} onLongPress={() => setPhase('setup')} accessibilityHint={t('fakeCall.longPressToStopThe')}>
        <StatusBar barStyle="light-content" />
        <Text style={s.waitText}>{t('fakeCall.keepSihamOpenYourPhone')}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('fakeCall.fakeCall')} />
      <View style={s.body}>
        <Text style={[{ fontSize: 14, lineHeight: 20 }, tc.color_textSec]}>
          {t('fakeCall.yourPhoneWillRingWith')}
        </Text>
        <Text style={[s.label, tc.color_text]}>{t('fakeCall.whoIsCalling')}</Text>
        <TextInput
          value={caller}
          onChangeText={setCaller}
          maxLength={30}
          style={[
            s.input,
            tc.color_text,
            tc.borderColor_surfaceVariant,
            tc.backgroundColor_surfaceVariant
          ]}
          accessibilityLabel={t('fakeCall.callerName')}
        />
        <Text style={[s.label, tc.color_text]}>{t('fakeCall.ringIn')}</Text>
        <View style={s.delays} accessibilityRole="radiogroup">
          {DELAYS.map(d => (
            <Pressable
              key={d.seconds}
              onPress={() => setDelay(d.seconds)}
              style={[
                s.delay,
                delay === d.seconds ? tc.borderColor_primary : tc.borderColor_border,
                delay === d.seconds ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: delay === d.seconds }}
            >
              <Text style={[{ fontWeight: '700' }, delay === d.seconds ? tc.color_primary : tc.color_text]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setPhase('waiting')} style={[s.start, tc.backgroundColor_primary]} accessibilityRole="button">
          <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>{t('fakeCall.start')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1 },
  body: { padding: 20, gap: 12 },
  label: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  delays: { flexDirection: 'row', gap: 8 },
  delay: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  start: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  waitRoot: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 32 },
  waitText: { color: '#555', fontSize: 13, textAlign: 'center' },
  callRoot: { flex: 1, backgroundColor: '#101418', justifyContent: 'space-between', alignItems: 'center' },
  callerBlock: { alignItems: 'center', gap: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#37474F', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 40, fontWeight: '600' },
  callerName: { color: 'white', fontSize: 32, fontWeight: '500' },
  callerSub: { color: '#B0BEC5', fontSize: 16 },
  callButtons: { flexDirection: 'row', gap: 80 },
  round: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
