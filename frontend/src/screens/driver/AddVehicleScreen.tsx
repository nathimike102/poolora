import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';
import { addVehicle } from '../../services/vehicleService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FEATURES_LIST = [
  { key: 'AC', emoji: '❄️' },
  { key: 'USB Charging', emoji: '🔌' },
  { key: 'Music', emoji: '🎵' },
  { key: 'WiFi Hotspot', emoji: '📶' },
  { key: 'Pet Friendly', emoji: '🐾' },
  { key: 'Women Only', emoji: '👩' },
];

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

/* ── Sub-components ──────────────────────────────────────── */

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

/* ═══════════════════════════════════════════════════════════ */
export function AddVehicleScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [vehicleName, setVehicleName] = useState('');
  const [color, setColor] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [modelYear, setModelYear] = useState('');
  const [seats, setSeats] = useState(4);
  const [features, setFeatures] = useState<string[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleFeature = (f: string) =>
    setFeatures(prev => (prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]));

  const isValid =
    vehicleName.trim().length > 0 &&
    color !== '' &&
    regNumber.trim().length > 4 &&
    modelYear.length === 4 &&
    seats >= 1;

  /* ── Image picker ── */
  const pickImage = async (source: 'gallery' | 'camera') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Needed', 'Camera permission is required to take a photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
          aspect: [16, 9],
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Needed', 'Gallery permission is required to select a photo.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
          aspect: [16, 9],
        });
      }

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const showImageOptions = () => {
    Alert.alert('Upload Vehicle Image', 'Choose a source', [
      { text: 'Camera', onPress: () => pickImage('camera') },
      { text: 'Gallery', onPress: () => pickImage('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    setTouched(true);
    if (!isValid) return;

    setSubmitting(true);
    try {
      await addVehicle({
        name: vehicleName.trim(),
        color,
        regNumber: regNumber.trim(),
        modelYear,
        seats,
        features,
        imageUri,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save vehicle. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[st.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Gradient header ─────────────────────────────── */}
      <LinearGradient
        colors={['#1A2E4A', c.primary]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={st.header}
      >
        <View style={st.headerRow}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={st.headerTitle}>Add Vehicle</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={st.headerSub}>Add a new vehicle to your fleet</Text>
      </LinearGradient>

      <ScrollView
        style={st.flex1}
        contentContainerStyle={st.scrollBody}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Vehicle Image ── */}
        <SectionCard title="VEHICLE IMAGE" c={c}>
          <Pressable onPress={showImageOptions} style={[st.imagePicker, { borderColor: c.border, backgroundColor: c.bg }]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={st.imagePreview} resizeMode="cover" />
            ) : (
              <View style={st.imagePlaceholder}>
                <Svg width={40} height={40} viewBox="0 0 24 24">
                  <Path
                    d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                    fill={c.textSec}
                  />
                </Svg>
                <Text style={{ fontSize: 13, color: c.textSec, marginTop: 8 }}>Tap to upload vehicle photo</Text>
                <Text style={{ fontSize: 11, color: c.textDisabled, marginTop: 2 }}>Camera or Gallery</Text>
              </View>
            )}
          </Pressable>
          {imageUri && (
            <Pressable onPress={showImageOptions} style={[st.changePhotoBtn, { borderColor: c.primary }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>Change Photo</Text>
            </Pressable>
          )}
        </SectionCard>

        {/* ── Vehicle Name ── */}
        <SectionCard title="VEHICLE DETAILS" c={c}>
          <View>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>VEHICLE NAME</Text>
            <TextInput
              placeholder="e.g. Maruti Swift Dzire"
              placeholderTextColor={c.textSec}
              value={vehicleName}
              onChangeText={setVehicleName}
              style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
            {touched && vehicleName.trim().length === 0 && <ErrMsg text="Enter vehicle name" />}
          </View>

          {/* Year + Seats */}
          <View style={st.twoCol}>
            <View style={st.col}>
              <Text style={[st.fieldLabel, { color: c.textSec }]}>MODEL YEAR</Text>
              <TextInput
                placeholder="e.g. 2021"
                placeholderTextColor={c.textSec}
                value={modelYear}
                onChangeText={v => setModelYear(v.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                keyboardType="number-pad"
                style={[st.textInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              />
              {touched && modelYear.length !== 4 && <ErrMsg text="Enter valid year" />}
            </View>
            <View style={st.col}>
              <Text style={[st.fieldLabel, { color: c.textSec }]}>NUMBER OF SEATS</Text>
              <View style={[st.stepperBox, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Pressable
                  onPress={() => setSeats(s => Math.max(1, s - 1))}
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

        {/* ── Registration Number ── */}
        <SectionCard title="REGISTRATION" c={c}>
          <View>
            <Text style={[st.fieldLabel, { color: c.textSec }]}>VEHICLE NUMBER / REGISTRATION</Text>
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
        </SectionCard>

        {/* ── Vehicle Colour ── */}
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
            {FEATURES_LIST.map(f => {
              const on = features.includes(f.key);
              return (
                <Pressable key={f.key} onPress={() => toggleFeature(f.key)}>
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
                      {f.emoji} {f.key}
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

      {/* ── Bottom CTA ─────────────────────────────────── */}
      <View style={[st.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Pressable onPress={handleSubmit} disabled={submitting}>
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[st.ctaGrad, submitting && { opacity: 0.7 }]}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="white" />
                </Svg>
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Add Vehicle</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════ */
const st = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: 'white' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, marginLeft: 4 },

  /* Scroll body */
  scrollBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  /* Section */
  secTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, paddingLeft: 2 },
  secCard: { borderRadius: 18, borderWidth: 1, padding: 18 },

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

  /* Two col */
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

  /* Colors */
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  colorItem: { alignItems: 'center', gap: 4, minWidth: 44 },
  colorCircle: { width: 36, height: 36, borderRadius: 18 },

  /* Image picker */
  imagePicker: {
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    minHeight: 160,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  changePhotoBtn: {
    marginTop: 10,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },

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
