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
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STEPS = ['Package Details', 'Shipping Info', 'Insurance', 'Review'];

const PARCEL_TYPES = [
  { id: 'documents', label: 'Documents', icon: '📄', maxWeight: '0.5 kg' },
  { id: 'electronics', label: 'Electronics', icon: '📱', maxWeight: '5 kg' },
  { id: 'clothing', label: 'Clothing', icon: '👕', maxWeight: '3 kg' },
  { id: 'food', label: 'Food Items', icon: '🍱', maxWeight: '2 kg' },
  { id: 'medicine', label: 'Medicine', icon: '💊', maxWeight: '1 kg' },
  { id: 'other', label: 'Other', icon: '📦', maxWeight: '10 kg' },
];

export function ShipParcelScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [parcelType, setParcelType] = useState('');
  const [insurance, setInsurance] = useState<'none' | 'basic' | 'premium'>('basic');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const insurancePlans = [
    { id: 'none' as const, label: 'No Insurance', price: 0, coverage: '—', emoji: '🚫' },
    { id: 'basic' as const, label: 'Basic', price: 20, coverage: 'Up to ₹2,000', emoji: '🛡️' },
    { id: 'premium' as const, label: 'Premium', price: 50, coverage: 'Up to ₹10,000', emoji: '⭐' },
  ];

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else navigation.navigate('ParcelResults');
  };

  /* ── Step 0: Package Details ─────────────────────────────── */
  const renderPackageDetails = () => (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>What are you shipping?</Text>

      <View style={s.typeGrid}>
        {PARCEL_TYPES.map(p => {
          const sel = parcelType === p.id;
          return (
            <Pressable key={p.id} onPress={() => setParcelType(p.id)} style={s.typeHalf}>
              <View
                style={[
                  s.typeCard,
                  {
                    borderColor: sel ? c.accent : c.border,
                    backgroundColor: sel ? '#FFF3EE' : c.surface,
                  },
                ]}
              >
                <Text style={{ fontSize: 32 }}>{p.icon}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? '#FF8A50' : c.text }}>{p.label}</Text>
                <Text style={{ fontSize: 11, color: c.textSec }}>Max {p.maxWeight}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {parcelType !== '' && (
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 }}>Package Details</Text>
          <View style={s.dimRow}>
            {['WEIGHT', 'LENGTH', 'WIDTH', 'HEIGHT'].map(f => (
              <View key={f} style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: c.textSec, marginBottom: 4 }}>{f}</Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor={c.textSec}
                  keyboardType="numeric"
                  style={[s.dimInput, { backgroundColor: c.bg, borderColor: c.border, color: c.text }]}
                />
              </View>
            ))}
          </View>
          <TextInput
            placeholder="Package description..."
            placeholderTextColor={c.textSec}
            multiline
            numberOfLines={2}
            style={[s.descInput, { backgroundColor: c.bg, borderColor: c.border, color: c.text }]}
          />
        </View>
      )}
    </View>
  );

  /* ── Step 1: Shipping Details ────────────────────────────── */
  const renderShippingDetails = () => (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>Shipping Details</Text>

      {/* From / To */}
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border, padding: 0, paddingHorizontal: 16 }]}>
        <View style={s.addressRow}>
          <View style={[s.dot, { backgroundColor: c.primary }]} />
          <TextInput
            value={from}
            onChangeText={setFrom}
            placeholder="Pickup address"
            placeholderTextColor={c.textSec}
            style={[s.addressInput, { color: c.text }]}
          />
        </View>
        <View style={[s.divider, { backgroundColor: c.border }]} />
        <View style={s.addressRow}>
          <View style={[s.square, { backgroundColor: c.error }]} />
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="Delivery address"
            placeholderTextColor={c.textSec}
            style={[s.addressInput, { color: c.text }]}
          />
        </View>
      </View>

      {/* Delivery window */}
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 }}>Delivery Window</Text>
        <View style={s.windowRow}>
          {['Today', 'Tomorrow', 'Next 3 days'].map(d => (
            <Pressable key={d} style={{ flex: 1 }}>
              <View style={[s.windowBtn, { borderColor: c.border, backgroundColor: c.bg }]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.textSec }}>{d}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Receiver */}
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 }}>Receiver Details</Text>
        {['Receiver Name', 'Receiver Phone', 'OTP on Delivery'].map(f => (
          <TextInput
            key={f}
            placeholder={f}
            placeholderTextColor={c.textSec}
            keyboardType={f === 'Receiver Phone' ? 'phone-pad' : 'default'}
            style={[s.receiverInput, { borderColor: c.border, backgroundColor: c.bg, color: c.text }]}
          />
        ))}
      </View>
    </View>
  );

  /* ── Step 2: Insurance ───────────────────────────────────── */
  const renderInsurance = () => (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>Insurance</Text>
      <Text style={{ fontSize: 14, color: c.textSec }}>Protect your parcel during transit</Text>

      {insurancePlans.map(plan => {
        const sel = insurance === plan.id;
        return (
          <Pressable key={plan.id} onPress={() => setInsurance(plan.id)}>
            <View
              style={[
                s.insuranceCard,
                {
                  borderColor: sel ? '#FF8A50' : c.border,
                  backgroundColor: sel ? '#FFF3EE' : c.surface,
                },
              ]}
            >
              <View
                style={[
                  s.insuranceIcon,
                  { backgroundColor: sel ? '#FF8A5020' : c.bg },
                ]}
              >
                <Text style={{ fontSize: 24 }}>{plan.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{plan.label}</Text>
                <Text style={{ fontSize: 13, color: c.textSec }}>{plan.coverage}</Text>
                {plan.price > 0 && (
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FF8A50', marginTop: 2 }}>+₹{plan.price}</Text>
                )}
              </View>
              {sel && (
                <View style={s.checkCircle}>
                  <Svg width={12} height={12} viewBox="0 0 24 24">
                    <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="white" />
                  </Svg>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  /* ── Step 3: Review ──────────────────────────────────────── */
  const renderReview = () => {
    const rows = [
      { label: 'Parcel Type', value: PARCEL_TYPES.find(p => p.id === parcelType)?.label || 'Documents' },
      { label: 'From', value: from || 'Koramangala, Bengaluru' },
      { label: 'To', value: to || 'Whitefield, Bengaluru' },
      { label: 'Insurance', value: insurancePlans.find(p => p.id === insurance)?.label || 'Basic' },
      { label: 'Estimated Cost', value: '₹85 + ₹20 insurance' },
    ];

    return (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>Review & Send</Text>
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1771848194068-169d817a1d6f?w=400&h=200&fit=crop"
          alt="Parcel"
          width="100%"
          height={140}
          borderRadius={16}
        />
        {rows.map(item => (
          <View key={item.label} style={[s.reviewRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 14, color: c.textSec }}>{item.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{item.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────── */}
      <LinearGradient
        colors={['#FF8A50', '#FF6B35']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={s.header}
      >
        <View style={s.headerRow}>
          <BackButton onPress={step === 0 ? () => navigation.goBack() : () => setStep(step - 1)} />
          <View style={{ marginLeft: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>Ship a Parcel</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </Text>
          </View>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` as any }]} />
        </View>
      </LinearGradient>

      {/* ── Content ────────────────────────────────────────── */}
      <ScrollView style={s.flex1} contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
        {step === 0 && renderPackageDetails()}
        {step === 1 && renderShippingDetails()}
        {step === 2 && renderInsurance()}
        {step === 3 && renderReview()}
      </ScrollView>

      {/* ── Bottom CTA ─────────────────────────────────────── */}
      <View style={[s.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Pressable onPress={handleNext}>
          <LinearGradient
            colors={['#FF8A50', '#FF6B35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ctaGrad}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>
              {step < STEPS.length - 1 ? 'Continue' : '📦 Find Drivers'}
            </Text>
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

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: 'white', borderRadius: 2 },

  scrollBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  /* Card */
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },

  /* Type grid */
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeHalf: { width: '47%' },
  typeCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
  },

  /* Dimensions */
  dimRow: { flexDirection: 'row', gap: 8 },
  dimInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  descInput: {
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    marginTop: 12,
    textAlignVertical: 'top',
    minHeight: 60,
  },

  /* Address */
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  addressInput: { flex: 1, fontSize: 15 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  square: { width: 10, height: 10, borderRadius: 2 },
  divider: { height: 1 },

  /* Delivery window */
  windowRow: { flexDirection: 'row', gap: 12 },
  windowBtn: { paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },

  /* Receiver */
  receiverInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 12,
  },

  /* Insurance */
  insuranceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  insuranceIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF8A50',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Review */
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },

  /* Bottom CTA */
  bottomBar: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  ctaGrad: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
