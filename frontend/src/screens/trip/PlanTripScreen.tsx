import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STEPS = ['Trip Details', 'Interests', 'Budget', 'Itinerary', 'Review'];

const INTERESTS = [
  '🏖️ Beach',
  '🏔️ Mountains',
  '🛕 Heritage',
  '🌿 Nature',
  '🍜 Food',
  '🎭 Culture',
  '🚵 Adventure',
  '🧘 Wellness',
  '📸 Photography',
  '🎵 Music',
];

const BUDGET_ITEMS = [
  { label: 'Accommodation', pct: 40 },
  { label: 'Transport', pct: 25 },
  { label: 'Food & Drinks', pct: 20 },
  { label: 'Activities', pct: 15 },
];

const ITINERARY_DAYS = [
  'Day 1: Travel & Check-in',
  'Day 2: Main Sightseeing',
  'Day 3: Local Experiences',
];

/* ─── Published success view ──────────────────────────────── */
function PublishedView({
  c,
  destination,
  groupSize,
  navigation,
}: {
  c: ReturnType<typeof useApp>['c'];
  destination: string;
  groupSize: number;
  navigation: Nav;
}) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 4, stiffness: 100 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[s.publishedRoot, { backgroundColor: c.bg }]}>
      <ReAnimated.View style={[s.publishedCircle, animStyle]}>
        <LinearGradient
          colors={['#00C853', '#00952A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.publishedGrad}
        >
          <Text style={{ fontSize: 44 }}>🗺️</Text>
        </LinearGradient>
      </ReAnimated.View>
      <Text style={{ fontSize: 24, fontWeight: '800', color: c.text }}>Trip Posted!</Text>
      <Text style={{ fontSize: 15, color: c.textSec, marginTop: 8 }}>
        {destination || 'Your dream trip'} · {groupSize} travelers
      </Text>
      <Pressable onPress={() => navigation.navigate('TripPartners' as any)} style={s.publishedBtnWrap}>
        <LinearGradient
          colors={['#00C853', '#00952A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.publishedBtn}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>Find Travel Partners</Text>
        </LinearGradient>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('RiderTabs' as any)}>
        <Text style={{ fontSize: 14, color: c.textSec }}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function PlanTripScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupSize, setGroupSize] = useState(4);
  const [budget, setBudget] = useState(5000);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [published, setPublished] = useState(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest],
    );
  };

  if (published) {
    return (
      <PublishedView
        c={c}
        destination={destination}
        groupSize={groupSize}
        navigation={navigation}
      />
    );
  }

  /* ── Step renderers ────────────────────────────────────── */
  const renderTripDetails = () => (
    <View style={s.stepGap}>
      <Text style={[s.stepTitle, { color: c.text }]}>Plan Your Trip</Text>

      {/* Title + Destination inputs */}
      {([
        { label: 'TRIP TITLE', placeholder: 'e.g. Goa Weekend Getaway', value: title, setter: setTitle },
        { label: 'DESTINATION', placeholder: 'e.g. Goa, Manali, Coorg', value: destination, setter: setDestination },
      ] as const).map(f => (
        <View key={f.label} style={[s.inputCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[s.inputLabel, { color: c.textSec }]}>{f.label}</Text>
          <TextInput
            value={f.value}
            onChangeText={f.setter}
            placeholder={f.placeholder}
            placeholderTextColor={c.textSec}
            style={[s.inputField, { color: c.text }]}
          />
        </View>
      ))}

      {/* Dates row */}
      <View style={s.dateRow}>
        {([
          { label: 'START DATE', value: startDate, setter: setStartDate, placeholder: 'DD/MM/YYYY' },
          { label: 'END DATE', value: endDate, setter: setEndDate, placeholder: 'DD/MM/YYYY' },
        ] as const).map(d => (
          <View key={d.label} style={[s.inputCard, { flex: 1, backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[s.inputLabel, { color: c.textSec }]}>{d.label}</Text>
            <TextInput
              value={d.value}
              onChangeText={d.setter}
              placeholder={d.placeholder}
              placeholderTextColor={c.textSec}
              style={[s.inputField, { color: c.text }]}
            />
          </View>
        ))}
      </View>

      {/* Group size */}
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 }}>Group Size</Text>
        <View style={s.stepperRow}>
          <Pressable
            onPress={() => setGroupSize(Math.max(2, groupSize - 1))}
            style={[s.stepperBtn, { backgroundColor: c.bg, borderColor: c.border }]}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M19 13H5v-2h14v2z" fill={c.textSec} />
            </Svg>
          </Pressable>
          <Text style={{ fontSize: 28, fontWeight: '800', color: c.primary, flex: 1, textAlign: 'center' }}>
            {groupSize} 👥
          </Text>
          <Pressable
            onPress={() => setGroupSize(Math.min(12, groupSize + 1))}
            style={[s.stepperBtn, { backgroundColor: c.primaryLight }]}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill={c.primary} />
            </Svg>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderInterests = () => (
    <View style={s.stepGap}>
      <Text style={[s.stepTitle, { color: c.text }]}>What are your interests?</Text>
      <Text style={{ fontSize: 14, color: c.textSec }}>
        Select all that apply to find compatible travel partners
      </Text>
      <View style={s.chipWrap}>
        {INTERESTS.map(interest => {
          const sel = selectedInterests.includes(interest);
          return (
            <Pressable
              key={interest}
              onPress={() => toggleInterest(interest)}
              style={[
                s.interestChip,
                {
                  borderColor: sel ? c.success : c.border,
                  backgroundColor: sel ? c.successLight : c.surface,
                },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: sel ? c.success : c.textSec }}>
                {interest}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {selectedInterests.length > 0 && (
        <View style={[s.infoBanner, { backgroundColor: c.successLight }]}>
          <Text style={{ fontSize: 13, color: c.success }}>✔ {selectedInterests.length} interests selected</Text>
        </View>
      )}
    </View>
  );

  const renderBudget = () => (
    <View style={s.stepGap}>
      <Text style={[s.stepTitle, { color: c.text }]}>Budget Breakdown</Text>

      {/* Budget per person */}
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 }}>Budget Per Person</Text>
        <Text style={{ fontSize: 32, fontWeight: '800', color: c.primary, textAlign: 'center', marginBottom: 8 }}>
          ₹{budget.toLocaleString()}
        </Text>
        {/* Slider row with buttons */}
        <View style={s.sliderRow}>
          <Pressable onPress={() => setBudget(Math.max(1000, budget - 500))}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.textSec }}>−</Text>
          </Pressable>
          <View style={[s.sliderTrack, { backgroundColor: c.bg }]}>
            <View
              style={[
                s.sliderFill,
                {
                  backgroundColor: c.primary,
                  width: `${((budget - 1000) / 49000) * 100}%` as any,
                },
              ]}
            />
          </View>
          <Pressable onPress={() => setBudget(Math.min(50000, budget + 500))}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.textSec }}>+</Text>
          </Pressable>
        </View>
        <View style={s.sliderLabels}>
          <Text style={{ fontSize: 12, color: c.textSec }}>₹1,000</Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>₹50,000</Text>
        </View>
      </View>

      {/* Breakdown bars */}
      {BUDGET_ITEMS.map(item => (
        <View key={item.label} style={[s.breakdownCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={s.breakdownRow}>
            <Text style={{ fontSize: 14, color: c.text }}>{item.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>
              ₹{Math.round((budget * item.pct) / 100).toLocaleString()}
            </Text>
          </View>
          <View style={[s.barTrack, { backgroundColor: c.bg }]}>
            <View style={[s.barFill, { width: `${item.pct}%` as any, backgroundColor: c.primary }]} />
          </View>
        </View>
      ))}
      <Text style={{ fontSize: 13, color: c.textSec }}>
        Total trip budget:{' '}
        <Text style={{ fontWeight: '700', color: c.text }}>₹{(budget * groupSize).toLocaleString()}</Text> for{' '}
        {groupSize} people
      </Text>
    </View>
  );

  const renderItinerary = () => (
    <View style={s.stepGap}>
      <Text style={[s.stepTitle, { color: c.text }]}>Rough Itinerary</Text>
      <Text style={{ fontSize: 14, color: c.textSec }}>
        Add planned activities (you can update this later)
      </Text>
      {ITINERARY_DAYS.map((day, i) => (
        <View key={i} style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary, marginBottom: 8 }}>{day}</Text>
          <TextInput
            placeholder="What are you planning? (optional)"
            placeholderTextColor={c.textSec}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            style={[s.textArea, { backgroundColor: c.bg, borderColor: c.border, color: c.text }]}
          />
        </View>
      ))}
      <Pressable style={[s.addDayBtn, { borderColor: c.border }]}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill={c.textSec} />
        </Svg>
        <Text style={{ fontSize: 14, color: c.textSec }}>Add More Days</Text>
      </Pressable>
    </View>
  );

  const renderReview = () => {
    const rows = [
      { label: 'Title', value: title || 'Goa Weekend Getaway' },
      { label: 'Destination', value: destination || 'Goa' },
      { label: 'Dates', value: startDate && endDate ? `${startDate} – ${endDate}` : '1 Mar – 3 Mar 2025' },
      { label: 'Group Size', value: `${groupSize} travelers` },
      { label: 'Budget/Person', value: `₹${budget.toLocaleString()}` },
      { label: 'Interests', value: selectedInterests.slice(0, 3).join(', ') || 'Beach, Nature, Food' },
    ];
    return (
      <View style={s.stepGap}>
        <Text style={[s.stepTitle, { color: c.text }]}>Review & Post</Text>
        {rows.map(item => (
          <View key={item.label} style={[s.reviewRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 14, color: c.textSec }}>{item.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, flexShrink: 1 }}>{item.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const stepContent = [renderTripDetails, renderInterests, renderBudget, renderItinerary, renderReview];

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <LinearGradient colors={['#00C853', '#00952A']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.header}>
        <View style={s.headerRow}>
          <BackButton onPress={step === 0 ? () => navigation.goBack() : () => setStep(step - 1)} />
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>Trip Pooling</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </Text>
          </View>
        </View>
        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` as any }]} />
        </View>
      </LinearGradient>

      {/* ── Body ────────────────────────────────────────────── */}
      <ScrollView style={s.flex1} contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
        {stepContent[step]()}
      </ScrollView>

      {/* ── CTA footer ─────────────────────────────────────── */}
      <View style={[s.footer, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Pressable
          onPress={() => {
            if (step < STEPS.length - 1) setStep(step + 1);
            else setPublished(true);
          }}
        >
          <LinearGradient
            colors={['#00C853', '#00952A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ctaBtn}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>
              {step < STEPS.length - 1 ? 'Continue' : '🗺️ Post Trip Plan'}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: 'white' },

  /* Scroll */
  scrollBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 16 },

  /* Steps common */
  stepGap: { gap: 16 },
  stepTitle: { fontSize: 20, fontWeight: '700' },

  /* Input card */
  inputCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  inputLabel: { fontSize: 11, fontWeight: '600' },
  inputField: { fontSize: 15, paddingTop: 4, paddingBottom: 12 },

  /* Dates */
  dateRow: { flexDirection: 'row', gap: 12 },

  /* Card */
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },

  /* Stepper */
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepperBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  /* Interests */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 2 },
  infoBanner: { padding: 12, borderRadius: 12 },

  /* Budget */
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  sliderFill: { height: '100%', borderRadius: 3 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },

  /* Breakdown */
  breakdownCard: { borderRadius: 14, borderWidth: 1, padding: 12, paddingHorizontal: 16 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  /* Itinerary */
  textArea: { borderRadius: 8, borderWidth: 1, padding: 8, paddingHorizontal: 12, fontSize: 13, minHeight: 56 },
  addDayBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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

  /* Published */
  publishedRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 24 },
  publishedCircle: { width: 90, height: 90, borderRadius: 45, overflow: 'hidden' },
  publishedGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  publishedBtnWrap: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  publishedBtn: { height: 56, alignItems: 'center', justifyContent: 'center' },

  /* Footer */
  footer: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12, borderTopWidth: 1 },
  ctaBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
