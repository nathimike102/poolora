import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
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

/* ── Onboarding step header (step 2) ──────────────────────── */
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
      <View style={os.headerRow}>
        <BackButton onPress={onBack} />
        <View style={{ marginLeft: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: 'white' }}>Driver Onboarding</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
            Step {step} of 3 · {steps[step - 1].label}
          </Text>
        </View>
      </View>

      <View style={os.progressTrack}>
        <View style={[os.progressFill, { width: `${(step / 3) * 100}%` as unknown as number }]} />
      </View>

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
                      <Path d={s.iconPath} fill={isActive ? c.primary : 'rgba(255,255,255,0.5)'} />
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
              {i < 2 && (
                <View
                  style={[os.connector, { backgroundColor: isDone ? '#10B981' : 'rgba(255,255,255,0.2)' }]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </LinearGradient>
  );
}

/* ── Sub-components ────────────────────────────────────────── */
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

function ErrMsg({ text }: { text: string }) {
  return <Text style={st.errMsg}>⚠ {text}</Text>;
}

/* ── Data ──────────────────────────────────────────────────── */
const VEHICLE_TYPES = ['Sedan', 'Hatchback', 'SUV', 'MPV', 'Electric', 'Auto'];
const VEHICLE_EMOJI: Record<string, string> = {
  Sedan: '🚗', Hatchback: '🚘', SUV: '🚙', MPV: '🚐', Electric: '⚡', Auto: '🛺',
};
const CAR_BRANDS = ['Maruti', 'Hyundai', 'Tata', 'Honda', 'Toyota', 'Mahindra', 'Kia', 'MG', 'Ford', 'Other'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];
const FUEL_EMOJI: Record<string, string> = {
  Petrol: '⛽', Diesel: '🛢', CNG: '🌿', Electric: '⚡', Hybrid: '🔋',
};
const FEATURES = ['AC', 'Music System', 'USB Charging', 'WiFi Hotspot', 'Pet Friendly', 'Women Only'];
const FEATURE_EMOJI: Record<string, string> = {
  AC: '❄️', 'Music System': '🎵', 'USB Charging': '🔌', 'WiFi Hotspot': '📶', 'Pet Friendly': '🐾', 'Women Only': '👩',
};
const COLORS_LIST = [
  { name: 'White', hex: '#F8F9FA' },
  { name: 'Silver', hex: '#ADB5BD' },
  { name: 'Black', hex: '#212529' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Grey', hex: '#6B7280' },
  { name: 'Gold', hex: '#D97706' },
  { name: 'Other', hex: '#E9E8F5' },
];

/* ═══════════════════════════════════════════════════════════════ */
export function VehicleDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [vehicleType, setVehicleType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [color, setColor] = useState('');
  const [seats, setSeats] = useState(4);
  const [fuelType, setFuelType] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const toggleFeature = (f: string) =>
    setFeatures(prev => (prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]));

  const isValid =
    vehicleType !== '' &&
    brand !== '' &&
    model.trim().length > 0 &&
    year.length === 4 &&
    regNumber.trim().length > 4 &&
    color !== '' &&
    fuelType !== '';

  const handleContinue = () => {
    setTouched(true);
    if (isValid) navigation.navigate('KYC');
  };

  return (
    <View style={[st.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <OnboardingStepHeader step={2} c={c} onBack={() => navigation.goBack()} />

      <ScrollView style={st.flex1} contentContainerStyle={st.scrollBody} showsVerticalScrollIndicator={false}>
        {/* ── Vehicle Type ── */}
        <SectionCard title="VEHICLE TYPE" c={c}>
          <View style={st.chipWrap}>
            {VEHICLE_TYPES.map(t => {
              const sel = vehicleType === t;
              return (
                <Pressable key={t} onPress={() => setVehicleType(t)}>
                  <View
                    style={[
                      st.chip,
                      {
                        borderColor: sel ? c.primary : c.border,
                        backgroundColor: sel ? c.primaryLight : c.surface,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: sel ? '700' : '500', color: sel ? c.primary : c.textSec }}>
                      {VEHICLE_EMOJI[t]} {t}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {touched && !vehicleType && <ErrMsg text="Select your vehicle type" />}
        </SectionCard>

        {/* ── Car Details ── */}
        <SectionCard title="CAR DETAILS" c={c}>
          {/* Brand */}
          <View>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>BRAND</Text>
            <View style={st.chipWrap}>
              {CAR_BRANDS.map(b => {
                const sel = brand === b;
                return (
                  <Pressable key={b} onPress={() => setBrand(b)}>
                    <View
                      style={[
                        st.chipSm,
                        {
                          borderColor: sel ? c.primary : c.border,
                          backgroundColor: sel ? c.primaryLight : c.bg,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: sel ? '700' : '400', color: sel ? c.primary : c.textSec }}>
                        {b}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {touched && !brand && <ErrMsg text="Select your car brand" />}
          </View>

          {/* Model */}
          <View style={{ marginTop: 16 }}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>MODEL NAME</Text>
            <TextInput
              placeholder="e.g. Swift Dzire, Creta, Nexon"
              placeholderTextColor={c.textSec}
              value={model}
              onChangeText={setModel}
              style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
            {touched && model.trim().length === 0 && <ErrMsg text="Enter car model" />}
          </View>

          {/* Year + Seats row */}
          <View style={st.twoCol}>
            <View style={st.col}>
              <Text style={[st.fieldLabel, { color: c.textSec }]}>YEAR</Text>
              <TextInput
                placeholder="e.g. 2021"
                placeholderTextColor={c.textSec}
                value={year}
                onChangeText={v => setYear(v.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                keyboardType="number-pad"
                style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              />
              {touched && year.length !== 4 && <ErrMsg text="Enter valid year" />}
            </View>

            <View style={st.col}>
              <Text style={[st.fieldLabel, { color: c.textSec }]}>SEATS</Text>
              <View style={[st.stepperBox, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Pressable
                  onPress={() => setSeats(s => Math.max(2, s - 1))}
                  style={[st.stepBtn, { backgroundColor: c.bg, borderColor: c.border }]}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path d="M19 13H5v-2h14v2z" fill={c.textSec} />
                  </Svg>
                </Pressable>
                <Text style={{ fontSize: 18, fontWeight: '800', color: c.text }}>{seats}</Text>
                <Pressable
                  onPress={() => setSeats(s => Math.min(9, s + 1))}
                  style={[st.stepBtn, { backgroundColor: c.bg, borderColor: c.border }]}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill={c.primary} />
                  </Svg>
                </Pressable>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* ── Registration ── */}
        <SectionCard title="REGISTRATION" c={c}>
          {/* Number plate */}
          <View>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>NUMBER PLATE</Text>
            <View style={[st.plateWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={st.plateBadge}>
                <Text style={{ fontSize: 10 }}>🇮🇳</Text>
                <Text style={{ fontSize: 7, color: 'white', fontWeight: '700', letterSpacing: 0.3 }}>IND</Text>
              </View>
              <TextInput
                placeholder="KA 01 AB 1234"
                placeholderTextColor={c.textSec}
                value={regNumber}
                onChangeText={v => setRegNumber(v.toUpperCase())}
                autoCapitalize="characters"
                style={{
                  flex: 1,
                  paddingHorizontal: 14,
                  fontSize: 17,
                  fontWeight: '800',
                  color: c.text,
                  letterSpacing: 3,
                  fontFamily: 'monospace',
                }}
              />
            </View>
            {touched && regNumber.trim().length < 5 && <ErrMsg text="Enter valid registration number" />}
          </View>

          {/* Fuel type */}
          <View style={{ marginTop: 16 }}>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>FUEL TYPE</Text>
            <View style={st.chipWrap}>
              {FUEL_TYPES.map(f => {
                const sel = fuelType === f;
                return (
                  <Pressable key={f} onPress={() => setFuelType(f)}>
                    <View
                      style={[
                        st.chip,
                        {
                          borderColor: sel ? c.primary : c.border,
                          backgroundColor: sel ? c.primaryLight : c.surface,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: sel ? '700' : '500', color: sel ? c.primary : c.textSec }}>
                        {FUEL_EMOJI[f]} {f}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {touched && !fuelType && <ErrMsg text="Select fuel type" />}
          </View>
        </SectionCard>

        {/* ── Colour ── */}
        <SectionCard title="VEHICLE COLOUR" c={c}>
          <View style={st.colorGrid}>
            {COLORS_LIST.map(col => {
              const sel = color === col.name;
              return (
                <Pressable key={col.name} onPress={() => setColor(col.name)} style={st.colorItem}>
                  <View
                    style={[
                      st.colorCircle,
                      {
                        backgroundColor: col.hex,
                        borderColor: sel ? c.primary : c.border,
                        borderWidth: sel ? 3 : 2,
                      },
                    ]}
                  />
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: sel ? '700' : '400',
                      color: sel ? c.primary : c.textSec,
                    }}
                  >
                    {col.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {touched && !color && <ErrMsg text="Select vehicle colour" />}
        </SectionCard>

        {/* ── Features ── */}
        <SectionCard title="FEATURES & AMENITIES" c={c}>
          <Text style={{ fontSize: 12, color: c.textSec, marginTop: -6 }}>
            Select all that apply — helps riders choose your ride
          </Text>
          <View style={[st.chipWrap, { marginTop: 8 }]}>
            {FEATURES.map(f => {
              const on = features.includes(f);
              return (
                <Pressable key={f} onPress={() => toggleFeature(f)}>
                  <View
                    style={[
                      st.chip,
                      {
                        borderColor: on ? c.primary : c.border,
                        backgroundColor: on ? c.primaryLight : c.surface,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: on ? '700' : '400', color: on ? c.primary : c.textSec }}>
                      {FEATURE_EMOJI[f]} {f}
                    </Text>
                    {on && (
                      <Svg width={12} height={12} viewBox="0 0 24 24">
                        <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill={c.primary} />
                      </Svg>
                    )}
                  </View>
                </Pressable>
              );
            })}
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Continue to Documents</Text>
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

  /* Section */
  secTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, paddingLeft: 2 },
  secCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 0 },

  /* Fields */
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginBottom: 8, paddingLeft: 2 },
  textInput: {
    height: 50,
    borderRadius: 13,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '500',
  },

  /* Chips */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipSm: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },

  /* Two-col */
  twoCol: { flexDirection: 'row', gap: 12, marginTop: 16 },
  col: { flex: 1 },

  /* Stepper */
  stepperBox: {
    height: 50,
    borderRadius: 13,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Plate input */
  plateWrap: {
    height: 54,
    borderRadius: 13,
    borderWidth: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  plateBadge: {
    width: 38,
    height: '100%',
    backgroundColor: '#003580',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },

  /* Colors */
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  colorItem: { alignItems: 'center', gap: 4, minWidth: 44 },
  colorCircle: { width: 36, height: 36, borderRadius: 18 },

  /* Error */
  errMsg: { fontSize: 12, color: '#F43F5E', marginTop: 5, paddingLeft: 4, fontWeight: '500' },

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
