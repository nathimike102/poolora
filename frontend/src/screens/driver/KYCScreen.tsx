import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── Types & data ──────────────────────────────────────────── */
type UploadState = 'idle' | 'uploading' | 'done';

interface UploadField {
  id: string;
  label: string;
  hint: string;
  state: UploadState;
}

const DOC_STEPS = [
  { id: 'aadhaar', label: 'Aadhaar', emoji: '🪪', color: '#3B82F6' },
  { id: 'liveness', label: 'Liveness', emoji: '🤳', color: '#7C3AED' },
  { id: 'driving', label: 'DL', emoji: '🚗', color: '#F59E0B' },
  { id: 'rc', label: 'RC', emoji: '📄', color: '#10B981' },
  { id: 'pan', label: 'PAN', emoji: '🧾', color: '#EC4899' },
  { id: 'insurance', label: 'Insurance', emoji: '🛡️', color: '#14B8A6' },
];

/* ── Sub-components ────────────────────────────────────────── */

function WarningBanner({ text, color }: { text: string; color: string }) {
  return (
    <View style={[s.warnBanner, { backgroundColor: color + '12', borderColor: color + '35' }]}>
      <Svg width={15} height={15} viewBox="0 0 24 24">
        <Path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          fill={color}
        />
      </Svg>
      <Text style={{ fontSize: 13, fontWeight: '600', color, flex: 1 }}>{text}</Text>
    </View>
  );
}

function InfoBox({
  color,
  title,
  items,
  textSecColor,
}: {
  color: string;
  title: string;
  items: string[];
  textSecColor: string;
}) {
  return (
    <View style={[s.infoBox, { backgroundColor: color + '10', borderColor: color + '28' }]}>
      <View style={s.infoHeader}>
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            fill={color}
          />
        </Svg>
        <Text style={{ fontSize: 13, fontWeight: '700', color }}>{title}</Text>
      </View>
      {items.map((item, i) => (
        <View key={i} style={s.infoRow}>
          <Text style={{ color, fontSize: 9, marginTop: 4 }}>●</Text>
          <Text style={{ fontSize: 12, color: textSecColor, lineHeight: 18, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function UploadBox({
  field,
  onUpload,
  cSurface,
  cBg,
  cBorder,
  cText,
  cTextSec,
  cSuccess,
  cPrimary,
  cPrimaryLight,
}: {
  field: UploadField;
  onUpload: (id: string) => void;
  cSurface: string;
  cBg: string;
  cBorder: string;
  cText: string;
  cTextSec: string;
  cSuccess: string;
  cPrimary: string;
  cPrimaryLight: string;
}) {
  const done = field.state === 'done';
  const uploading = field.state === 'uploading';
  return (
    <Pressable onPress={() => !done && onUpload(field.id)}>
      <View
        style={[
          s.uploadRow,
          {
            backgroundColor: done ? cSuccess + '12' : cSurface,
            borderColor: done ? cSuccess + '50' : cBorder,
            borderStyle: done ? 'solid' : 'dashed',
          },
        ]}
      >
        <View
          style={[
            s.uploadIcon,
            {
              backgroundColor: done ? cSuccess + '20' : cBg,
              borderColor: done ? cSuccess + '40' : cBorder,
            },
          ]}
        >
          {done ? (
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill={cSuccess} />
            </Svg>
          ) : uploading ? (
            <ActivityIndicator size="small" color={cPrimary} />
          ) : (
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"
                fill={cTextSec}
              />
            </Svg>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: done ? cSuccess : cText }}>
            {done ? `${field.label} — Uploaded ✓` : field.label}
          </Text>
          <Text style={{ fontSize: 12, color: cTextSec, marginTop: 2 }}>{field.hint}</Text>
        </View>
        {!done && (
          <View style={[s.browseBtn, { backgroundColor: cPrimaryLight }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: cPrimary }}>Browse</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function KYCScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [docStep, setDocStep] = useState(0);
  const [completedDoc, setCompletedDoc] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  // Step 0 – Aadhaar
  const [aadhaarNum, setAadhaarNum] = useState('');

  // Step 1 – Liveness
  const [livenessDone, setLivenessDone] = useState(false);

  // Step 2 – DL
  const [dlUploads, setDlUploads] = useState<UploadField[]>([
    { id: 'dl_front', label: 'Upload Front Side', hint: 'DL number must be visible', state: 'idle' },
    { id: 'dl_back', label: 'Upload Back Side', hint: 'Address & vehicle category visible', state: 'idle' },
  ]);
  const [dlNumber, setDlNumber] = useState('');

  // Step 3 – RC
  const [rcUploads, setRcUploads] = useState<UploadField[]>([
    { id: 'rc_front', label: 'Upload RC Front', hint: 'Reg. number & owner name visible', state: 'idle' },
    { id: 'rc_back', label: 'Upload RC Back', hint: 'Insurance & fitness details visible', state: 'idle' },
  ]);
  const [plateNum, setPlateNum] = useState('');

  // Step 4 – PAN
  const [panUploads, setPanUploads] = useState<UploadField[]>([
    { id: 'pan_card', label: 'Upload PAN Card', hint: 'Name, PAN number & DOB visible', state: 'idle' },
  ]);
  const [panNumber, setPanNumber] = useState('');

  // Step 5 – Insurance
  const [insUploads, setInsUploads] = useState<UploadField[]>([
    { id: 'ins_doc', label: 'Upload Insurance Certificate', hint: 'Valid & non-expired certificate', state: 'idle' },
  ]);
  const [policyNum, setPolicyNum] = useState('');
  const [expiry, setExpiry] = useState('');

  /* helpers */
  const allDone = (fields: UploadField[]) => fields.every(f => f.state === 'done');

  const handleUpload = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<UploadField[]>>,
  ) => {
    setter(prev => prev.map(f => (f.id === id ? { ...f, state: 'uploading' as UploadState } : f)));
    setTimeout(
      () => setter(prev => prev.map(f => (f.id === id ? { ...f, state: 'done' as UploadState } : f))),
      1200,
    );
  };

  const handleAadhaar = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 12);
    const parts = [d.slice(0, 4), d.slice(4, 8), d.slice(8, 12)].filter(Boolean);
    setAadhaarNum(parts.join(' '));
  };

  const canProceed = () => {
    if (docStep === 0) return aadhaarNum.replace(/\s/g, '').length === 12;
    if (docStep === 1) return livenessDone;
    if (docStep === 2) return allDone(dlUploads) && dlNumber.trim().length > 5;
    if (docStep === 3) return allDone(rcUploads) && plateNum.trim().length > 3;
    if (docStep === 4) return allDone(panUploads) && panNumber.trim().length === 10;
    if (docStep === 5) return allDone(insUploads) && policyNum.trim().length > 3 && expiry.length > 0;
    return false;
  };

  const handleContinue = () => {
    setCompletedDoc(prev => new Set(prev).add(docStep));
    if (docStep < DOC_STEPS.length - 1) {
      setDocStep(docStep + 1);
    } else {
      setSubmitted(true);
    }
  };

  const ds = DOC_STEPS[docStep];
  const ok = canProceed();

  /* ── Published success animation ─────────────────────────── */
  const pubScale = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (submitted) {
      Animated.spring(pubScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
  }, [submitted]);

  /* ═══════════ SUBMITTED VIEW ═══════════════════════════════ */
  if (submitted) {
    return (
      <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient
          colors={[c.primaryDark, c.primary]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={s.onbHeader}
        >
          <BackButton onPress={() => navigation.goBack()} />
          <View style={{ marginLeft: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: 'white' }}>Driver Onboarding</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Step 3 of 3 · Documents</Text>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={s.submitBody} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: c.successLight,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pubScale }],
            }}
          >
            <Text style={{ fontSize: 40 }}>🎉</Text>
          </Animated.View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, marginTop: 20 }}>All Done!</Text>
          <Text style={{ fontSize: 14, color: c.textSec, marginTop: 8, lineHeight: 22, textAlign: 'center' }}>
            All 6 documents submitted. Our team will verify within 2–4 hours.
          </Text>

          {/* Status list */}
          <View style={[s.submitList, { backgroundColor: c.surface, borderColor: c.border }]}>
            {DOC_STEPS.map((st, i) => (
              <View key={st.id} style={s.submitRow}>
                <View style={[s.submitEmoji, { backgroundColor: st.color + '18' }]}>
                  <Text style={{ fontSize: 18 }}>{st.emoji}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14, color: c.text, fontWeight: '500' }}>{st.label}</Text>
                <View
                  style={[
                    s.submitBadge,
                    {
                      backgroundColor: completedDoc.has(i) ? c.successLight : c.bg,
                      borderColor: c.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: completedDoc.has(i) ? c.success : c.textSec,
                    }}
                  >
                    {completedDoc.has(i) ? 'Submitted ✓' : 'Skipped'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable onPress={() => navigation.navigate('DriverTabs' as any)} style={{ width: '100%', marginTop: 20 }}>
            <LinearGradient
              colors={[c.primary, c.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.ctaGrad}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Go to Dashboard</Text>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="white" />
              </Svg>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  /* ═══════════ MAIN VIEW ════════════════════════════════════ */
  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Onboarding header ──────────────────────────────── */}
      <LinearGradient
        colors={[c.primaryDark, c.primary]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={s.onbHeader}
      >
        <BackButton
          onPress={docStep === 0 ? () => navigation.goBack() : () => setDocStep(docStep - 1)}
        />
        <View style={{ marginLeft: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: 'white' }}>Driver Onboarding</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Step 3 of 3 · Documents</Text>
        </View>
      </LinearGradient>

      {/* ── Doc sub-step tabs ──────────────────────────────── */}
      <View style={[s.tabSection, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        {/* Progress bar */}
        <View style={[s.progressTrack, { backgroundColor: c.border }]}>
          <LinearGradient
            colors={[c.primary, ds.color]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[s.progressFill, { width: `${((docStep + 1) / DOC_STEPS.length) * 100}%` as any }]}
          />
        </View>

        {/* Tab row */}
        <View style={s.tabRow}>
          {DOC_STEPS.map((st, i) => {
            const isDone = completedDoc.has(i);
            const isActive = i === docStep;
            return (
              <Pressable key={st.id} onPress={() => isDone && setDocStep(i)} style={s.tabItem}>
                <View
                  style={[
                    s.tabCircle,
                    {
                      backgroundColor: isDone ? c.successLight : isActive ? st.color + '18' : c.bg,
                      borderColor: isDone ? c.success + '60' : isActive ? st.color : c.border,
                      borderWidth: isActive ? 2 : 1.5,
                    },
                  ]}
                >
                  {isDone ? (
                    <Svg width={14} height={14} viewBox="0 0 24 24">
                      <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill={c.success} />
                    </Svg>
                  ) : (
                    <Text style={{ fontSize: 16 }}>{st.emoji}</Text>
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: isActive ? '700' : '500',
                    color: isDone ? c.success : isActive ? st.color : c.textSec,
                  }}
                >
                  {st.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Step content ───────────────────────────────────── */}
      <ScrollView
        style={s.flex1}
        contentContainerStyle={s.stepBody}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.heroCenter}>
          <View style={[s.heroIcon, { backgroundColor: ds.color + '18', borderColor: ds.color + '35' }]}>
            <Text style={{ fontSize: 34 }}>{ds.emoji}</Text>
          </View>
          <Text style={{ fontSize: 21, fontWeight: '800', color: c.text, textAlign: 'center' }}>
            {docStep === 0 && 'Aadhaar Verification'}
            {docStep === 1 && 'Liveness Check'}
            {docStep === 2 && 'Driving Licence'}
            {docStep === 3 && 'Vehicle Registration (RC)'}
            {docStep === 4 && 'PAN Card'}
            {docStep === 5 && 'Vehicle Insurance'}
          </Text>
          <Text style={{ fontSize: 13, color: c.textSec, textAlign: 'center', marginTop: 3 }}>
            {docStep === 0 && 'Required for driver identity verification'}
            {docStep === 1 && 'Real-time face match to confirm identity'}
            {docStep === 2 && 'Upload a valid, non-expired Indian DL'}
            {docStep === 3 && "Upload your vehicle's Registration Certificate"}
            {docStep === 4 && 'Required for income tax compliance'}
            {docStep === 5 && 'Upload a valid vehicle insurance certificate'}
          </Text>
        </View>

        {/* ── AADHAAR ── */}
        {docStep === 0 && (
          <View style={{ gap: 16 }}>
            <WarningBanner text="Mandatory for all drivers. Cannot be skipped." color={c.error} />
            <View>
              <Text style={[s.fieldLabel, { color: c.textSec }]}>AADHAAR NUMBER</Text>
              <TextInput
                placeholder="XXXX  XXXX  XXXX"
                placeholderTextColor={c.textSec}
                value={aadhaarNum}
                onChangeText={handleAadhaar}
                maxLength={14}
                keyboardType="number-pad"
                style={[
                  s.styledInput,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                    letterSpacing: 3,
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    fontSize: 17,
                  },
                ]}
              />
            </View>
            <InfoBox
              color="#3B82F6"
              title="Privacy Protection"
              textSecColor={c.textSec}
              items={[
                'Encrypted with AES-256 — never stored in plain text',
                'Shared only with UIDAI for verification',
                'Deleted from servers after verification',
              ]}
            />
          </View>
        )}

        {/* ── LIVENESS ── */}
        {docStep === 1 && (
          <View style={{ gap: 16 }}>
            <WarningBanner text="Live face scan required. No photos allowed." color={c.primary} />
            <View
              style={[
                s.livenessBox,
                {
                  borderColor: livenessDone ? c.success + '60' : c.border,
                  backgroundColor: livenessDone ? c.successLight : c.surface,
                },
              ]}
            >
              {livenessDone ? (
                <View style={s.heroCenter}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: c.successLight,
                      borderWidth: 2,
                      borderColor: c.success + '40',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Svg width={28} height={28} viewBox="0 0 24 24">
                      <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill={c.success} />
                    </Svg>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.success }}>Liveness Verified ✓</Text>
                  <Text style={{ fontSize: 12, color: c.textSec }}>Face matched successfully</Text>
                </View>
              ) : (
                <View style={s.heroCenter}>
                  <Text style={{ fontSize: 48 }}>🤳</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>
                    Position your face in the frame and blink when prompted
                  </Text>
                  <Text style={{ fontSize: 12, color: c.textSec, textAlign: 'center' }}>
                    No sunglasses · Good lighting · Face clearly visible
                  </Text>
                  <Pressable onPress={() => setLivenessDone(true)}>
                    <LinearGradient
                      colors={[c.primary, c.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.liveBtn}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>Start Liveness Check</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              )}
            </View>
            <InfoBox
              color={c.primary}
              title="How it works"
              textSecColor={c.textSec}
              items={[
                'Short video (3–5 s) captured in real time',
                'AI checks liveness — cannot be spoofed with photos',
                'Data encrypted and deleted post-verification',
              ]}
            />
          </View>
        )}

        {/* ── DRIVING LICENCE ── */}
        {docStep === 2 && (
          <View style={{ gap: 16 }}>
            <WarningBanner text="Both sides are mandatory. No skip allowed." color={c.error} />
            {dlUploads.map(f => (
              <UploadBox
                key={f.id}
                field={f}
                onUpload={id => handleUpload(id, setDlUploads)}
                cSurface={c.surface}
                cBg={c.bg}
                cBorder={c.border}
                cText={c.text}
                cTextSec={c.textSec}
                cSuccess={c.success}
                cPrimary={c.primary}
                cPrimaryLight={c.primaryLight}
              />
            ))}
            <View>
              <Text style={[s.fieldLabel, { color: c.textSec }]}>DL NUMBER</Text>
              <TextInput
                placeholder="e.g. KA01 20190012345"
                placeholderTextColor={c.textSec}
                value={dlNumber}
                onChangeText={setDlNumber}
                maxLength={20}
                style={[s.styledInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              />
            </View>
            <InfoBox
              color="#F59E0B"
              title="Requirements"
              textSecColor={c.textSec}
              items={[
                'Valid & not expired',
                'Must cover the vehicle category you drive',
                'Verified within 2–4 hours by Sanchari AI',
              ]}
            />
          </View>
        )}

        {/* ── RC ── */}
        {docStep === 3 && (
          <View style={{ gap: 16 }}>
            <WarningBanner text="RC must be in your name. Both sides mandatory." color="#10B981" />
            {rcUploads.map(f => (
              <UploadBox
                key={f.id}
                field={f}
                onUpload={id => handleUpload(id, setRcUploads)}
                cSurface={c.surface}
                cBg={c.bg}
                cBorder={c.border}
                cText={c.text}
                cTextSec={c.textSec}
                cSuccess={c.success}
                cPrimary={c.primary}
                cPrimaryLight={c.primaryLight}
              />
            ))}
            <View>
              <Text style={[s.fieldLabel, { color: c.textSec }]}>NUMBER PLATE</Text>
              <View style={[s.plateWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={s.plateBadge}>
                  <Text style={{ fontSize: 11 }}>🇮🇳</Text>
                  <Text style={{ fontSize: 7, color: 'white', fontWeight: '700' }}>IND</Text>
                </View>
                <TextInput
                  placeholder="KA 01 AB 1234"
                  placeholderTextColor={c.textSec}
                  value={plateNum}
                  onChangeText={v => setPlateNum(v.toUpperCase())}
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
            </View>
            <InfoBox
              color="#10B981"
              title="Accepted vehicle types"
              textSecColor={c.textSec}
              items={['Sedan / Hatchback / SUV', 'Auto / Electric vehicle', 'Bike / Scooter for parcels only']}
            />
          </View>
        )}

        {/* ── PAN ── */}
        {docStep === 4 && (
          <View style={{ gap: 16 }}>
            <WarningBanner text="PAN required for income tax compliance." color="#EC4899" />
            {panUploads.map(f => (
              <UploadBox
                key={f.id}
                field={f}
                onUpload={id => handleUpload(id, setPanUploads)}
                cSurface={c.surface}
                cBg={c.bg}
                cBorder={c.border}
                cText={c.text}
                cTextSec={c.textSec}
                cSuccess={c.success}
                cPrimary={c.primary}
                cPrimaryLight={c.primaryLight}
              />
            ))}
            <View>
              <Text style={[s.fieldLabel, { color: c.textSec }]}>PAN NUMBER</Text>
              <TextInput
                placeholder="e.g. ABCDE1234F"
                placeholderTextColor={c.textSec}
                value={panNumber}
                onChangeText={v => setPanNumber(v.toUpperCase().slice(0, 10))}
                maxLength={10}
                autoCapitalize="characters"
                style={[
                  s.styledInput,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                    letterSpacing: 3,
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    fontSize: 17,
                  },
                ]}
              />
            </View>
            <InfoBox
              color="#EC4899"
              title="PAN Card requirements"
              textSecColor={c.textSec}
              items={[
                'Issued by Income Tax Department of India',
                'Name on PAN must match your Aadhaar',
                '10-character format — e.g. ABCDE1234F',
              ]}
            />
          </View>
        )}

        {/* ── INSURANCE ── */}
        {docStep === 5 && (
          <View style={{ gap: 16 }}>
            <WarningBanner text="Valid & non-expired insurance mandatory." color="#14B8A6" />
            {insUploads.map(f => (
              <UploadBox
                key={f.id}
                field={f}
                onUpload={id => handleUpload(id, setInsUploads)}
                cSurface={c.surface}
                cBg={c.bg}
                cBorder={c.border}
                cText={c.text}
                cTextSec={c.textSec}
                cSuccess={c.success}
                cPrimary={c.primary}
                cPrimaryLight={c.primaryLight}
              />
            ))}
            <View>
              <Text style={[s.fieldLabel, { color: c.textSec }]}>POLICY NUMBER</Text>
              <TextInput
                placeholder="e.g. OG-24-1234-1234"
                placeholderTextColor={c.textSec}
                value={policyNum}
                onChangeText={setPolicyNum}
                style={[s.styledInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              />
            </View>
            <View>
              <Text style={[s.fieldLabel, { color: c.textSec }]}>POLICY EXPIRY DATE</Text>
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor={c.textSec}
                value={expiry}
                onChangeText={setExpiry}
                style={[s.styledInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              />
            </View>
            <InfoBox
              color="#14B8A6"
              title="Insurance requirements"
              textSecColor={c.textSec}
              items={[
                '3rd-party or comprehensive accepted',
                'Must cover at least 3rd-party liability',
                'Policy must be valid for the next 30+ days',
              ]}
            />
          </View>
        )}

        <Text style={{ fontSize: 11, color: c.textSec, textAlign: 'center', marginTop: 8 }}>
          ○ Documents reviewed within 2–4 hours by Sanchari AI
        </Text>
      </ScrollView>

      {/* ── Bottom CTA ─────────────────────────────────────── */}
      <View style={[s.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Pressable onPress={handleContinue} disabled={!ok}>
          <LinearGradient
            colors={ok ? [c.primary, c.primaryDark] : [c.border, c.border]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ctaGrad}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: ok ? 'white' : c.textSec }}>
              {docStep === 0 && 'Verify Aadhaar'}
              {docStep === 1 && 'Confirm Liveness'}
              {docStep === 2 && 'Upload DL & Continue'}
              {docStep === 3 && 'Upload RC & Continue'}
              {docStep === 4 && 'Upload PAN & Continue'}
              {docStep === 5 && 'Submit All Documents'}
            </Text>
            {ok && (
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="white" />
              </Svg>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Onboarding header */
  onbHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },

  /* Tab section */
  tabSection: { borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 2 },
  tabRow: { flexDirection: 'row', gap: 4 },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  /* Step body */
  stepBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  /* Hero */
  heroCenter: { alignItems: 'center', gap: 8, marginBottom: 16 },
  heroIcon: { width: 68, height: 68, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  /* Warning banner */
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },

  /* Info box */
  infoBox: { borderRadius: 14, borderWidth: 1, padding: 14 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },

  /* Upload box */
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  uploadIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },

  /* Field label */
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginBottom: 8 },

  /* Styled input */
  styledInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    fontSize: 15,
    fontWeight: '500',
  },

  /* Plate input */
  plateWrap: { height: 52, borderRadius: 14, borderWidth: 2, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  plateBadge: {
    width: 40,
    height: '100%',
    backgroundColor: '#003580',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },

  /* Liveness */
  livenessBox: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 18, padding: 24, minHeight: 190 },
  liveBtn: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12, marginTop: 4 },

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

  /* Submitted */
  submitBody: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  submitList: { width: '100%', borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 20, gap: 12, ...Shadow.sm },
  submitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  submitEmoji: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  submitBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
});
