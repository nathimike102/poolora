import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── Onboarding step header (shared concept across 3 onboarding screens) ── */
function OnboardingStepHeader({
  step,
  c,
  onBack,
}: {
  step: 1 | 2 | 3;
  c: ReturnType<typeof useApp>['c'];
  onBack: () => void;
}) {
  const steps = [
    { label: 'Personal', iconPath: 'M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z' },
    { label: 'Vehicle', iconPath: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-5h14v5z' },
    { label: 'Documents', iconPath: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2z' },
  ];

  return (
    <LinearGradient
      colors={[c.primaryDark, c.primary]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={os.headerGrad}
    >
      {/* Top bar */}
      <View style={os.headerRow}>
        <BackButton onPress={onBack} />
        <View style={{ marginLeft: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: 'white' }}>Driver Onboarding</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
            Step {step} of 3 · {steps[step - 1].label}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={os.progressTrack}>
        <View style={[os.progressFill, { width: `${(step / 3) * 100}%` as any }]} />
      </View>

      {/* Step pills */}
      <View style={os.pillRow}>
        {steps.map((s, i) => {
          const idx = i + 1;
          const isDone = idx < step;
          const isActive = idx === step;
          return (
            <React.Fragment key={s.label}>
              <View style={os.pillCol}>
                <View
                  style={[
                    os.pillCircle,
                    {
                      backgroundColor: isDone ? '#10B981' : isActive ? 'white' : 'rgba(255,255,255,0.15)',
                      borderWidth: isDone || isActive ? 0 : 1.5,
                      borderColor: 'rgba(255,255,255,0.3)',
                    },
                    isActive && Shadow.sm,
                  ]}
                >
                  {isDone ? (
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="white" />
                    </Svg>
                  ) : (
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      <Path
                        d={s.iconPath}
                        fill={isActive ? c.primary : 'rgba(255,255,255,0.5)'}
                      />
                      {/* Vehicle circles */}
                      {i === 1 && (
                        <>
                          <Circle cx={7.5} cy={14.5} r={1.5} fill={isActive ? c.primary : 'rgba(255,255,255,0.5)'} />
                          <Circle cx={16.5} cy={14.5} r={1.5} fill={isActive ? c.primary : 'rgba(255,255,255,0.5)'} />
                        </>
                      )}
                    </Svg>
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                  }}
                >
                  {s.label}
                </Text>
              </View>
              {/* Connector */}
              {i < 2 && (
                <View
                  style={[
                    os.connector,
                    { backgroundColor: isDone ? '#10B981' : 'rgba(255,255,255,0.2)' },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </LinearGradient>
  );
}

/* ── Section card ──────────────────────────────────────────── */
function SectionCard({
  title,
  children,
  c,
}: {
  title: string;
  children: React.ReactNode;
  c: ReturnType<typeof useApp>['c'];
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[st.secTitle, { color: c.textSec }]}>{title}</Text>
      <View style={[st.secCard, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
    </View>
  );
}

/* ── Error message ─────────────────────────────────────────── */
function ErrMsg({ text }: { text: string }) {
  return (
    <Text style={st.errMsg}>⚠ {text}</Text>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function PersonalDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [touched, setTouched] = useState(false);

  const isValid =
    fullName.trim().length > 2 &&
    dob.length > 0 &&
    gender !== '' &&
    email.includes('@') &&
    city.trim().length > 0;

  const handleContinue = () => {
    setTouched(true);
    if (isValid) navigation.navigate('VehicleDetails');
  };

  return (
    <View style={[st.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <OnboardingStepHeader step={1} c={c} onBack={() => navigation.goBack()} />

      <ScrollView style={st.flex1} contentContainerStyle={st.scrollBody} showsVerticalScrollIndicator={false}>
        {/* ── Section: Basic Info ── */}
        <SectionCard title="BASIC INFORMATION" c={c}>
          {/* Full name */}
          <View style={st.fieldWrap}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>FULL NAME</Text>
            <TextInput
              placeholder="e.g. Rajesh Kumar"
              placeholderTextColor={c.textSec}
              value={fullName}
              onChangeText={setFullName}
              style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
            {touched && fullName.trim().length < 3 && <ErrMsg text="Enter your full name" />}
          </View>

          {/* DOB */}
          <View style={st.fieldWrap}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>DATE OF BIRTH</Text>
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.textSec}
              value={dob}
              onChangeText={setDob}
              style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: dob ? c.text : c.textSec }]}
            />
            {touched && !dob && <ErrMsg text="Select your date of birth" />}
          </View>

          {/* Gender */}
          <View style={st.fieldWrap}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>GENDER</Text>
            <View style={st.genderRow}>
              {(['Male', 'Female', 'Other'] as const).map(g => {
                const sel = gender === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGender(g)}
                    style={[
                      st.genderBtn,
                      {
                        borderColor: sel ? c.primary : c.border,
                        backgroundColor: sel ? c.primaryLight : c.surface,
                      },
                    ]}
                  >
                    <View
                      style={[
                        st.radio,
                        {
                          borderColor: sel ? c.primary : c.border,
                          backgroundColor: sel ? c.primary : 'transparent',
                        },
                      ]}
                    >
                      {sel && <View style={st.radioDot} />}
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: sel ? '700' : '500',
                        color: sel ? c.primary : c.textSec,
                      }}
                    >
                      {g}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {touched && !gender && <ErrMsg text="Select your gender" />}
          </View>
        </SectionCard>

        {/* ── Section: Contact ── */}
        <SectionCard title="CONTACT DETAILS" c={c}>
          <View style={st.fieldWrap}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>PHONE NUMBER</Text>
            <TextInput
              placeholder="+91 98765 43210"
              placeholderTextColor={c.textSec}
              value="+91 98765 43210"
              editable={false}
              style={[st.textInput, { backgroundColor: c.bg, borderColor: c.border, color: c.textSec, opacity: 0.7 }]}
            />
          </View>
          <View style={st.fieldWrap}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>EMAIL ADDRESS</Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor={c.textSec}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
            {touched && !email.includes('@') && <ErrMsg text="Enter a valid email address" />}
          </View>
        </SectionCard>

        {/* ── Section: Location ── */}
        <SectionCard title="HOME LOCATION" c={c}>
          <View style={st.fieldWrap}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>CITY</Text>
            <TextInput
              placeholder="e.g. Bengaluru"
              placeholderTextColor={c.textSec}
              value={city}
              onChangeText={setCity}
              style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
            {touched && !city.trim() && <ErrMsg text="Enter your city" />}
          </View>
          <View style={st.fieldWrap}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>AREA / LOCALITY</Text>
            <TextInput
              placeholder="e.g. Koramangala, HSR Layout"
              placeholderTextColor={c.textSec}
              value={area}
              onChangeText={setArea}
              style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
          </View>
        </SectionCard>

        {/* ── Section: Emergency Contact ── */}
        <SectionCard title="EMERGENCY CONTACT (OPTIONAL)" c={c}>
          {/* Warning banner */}
          <View style={[st.ecWarn, { backgroundColor: c.warning + '15', borderColor: c.warning + '30' }]}>
            <Svg width={15} height={15} viewBox="0 0 24 24" style={{ marginTop: 2 }}>
              <Path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                fill={c.warning}
              />
            </Svg>
            <Text style={{ fontSize: 12, color: c.warning, lineHeight: 18, fontWeight: '500', flex: 1 }}>
              Riders will see this contact if you don't respond during an active trip.
            </Text>
          </View>

          <View style={st.fieldWrap}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>CONTACT NAME</Text>
            <TextInput
              placeholder="e.g. Suresh Kumar"
              placeholderTextColor={c.textSec}
              value={ecName}
              onChangeText={setEcName}
              style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
          </View>
          <View style={st.fieldWrap}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>CONTACT PHONE</Text>
            <TextInput
              placeholder="+91 XXXXX XXXXX"
              placeholderTextColor={c.textSec}
              value={ecPhone}
              onChangeText={setEcPhone}
              keyboardType="phone-pad"
              style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
          </View>
        </SectionCard>
      </ScrollView>

      {/* ── Bottom CTA ─────────────────────────────────────── */}
      <View style={[st.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Pressable onPress={handleContinue}>
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.ctaGrad}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>
              Continue to Vehicle Details
            </Text>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="white" />
            </Svg>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const os = StyleSheet.create({
  headerGrad: { paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: 'white', borderRadius: 2 },
  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  pillCol: { alignItems: 'center', gap: 4 },
  pillCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  connector: { width: 40, height: 2, borderRadius: 1, marginHorizontal: 4, marginBottom: 16 },
});

const st = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  /* Section card */
  secTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, paddingLeft: 2 },
  secCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 16 },

  /* Field */
  fieldWrap: { marginBottom: 0 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginBottom: 8, paddingLeft: 2 },
  textInput: {
    height: 50,
    borderRadius: 13,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '500',
  },

  /* Gender */
  genderRow: { flexDirection: 'row', gap: 12 },
  genderBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'white' },

  /* Error */
  errMsg: { fontSize: 12, color: '#F43F5E', marginTop: 5, paddingLeft: 4, fontWeight: '500' },

  /* EC Warning */
  ecWarn: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4 },

  /* Bottom CTA */
  bottomBar: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 },
  ctaGrad: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
