/**
 * screens/trip/PlanTripScreen.tsx
 *
 * Plan a group trip (UC-T01): what and where, when, budget, interests, a
 * day-by-day outline, how many can come, and whether others can find it.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { RideDatePicker } from '../../components/RideDatePicker';
import { tripService, TRIP_INTERESTS, type TripType } from '../../services/tripService';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';
import { moneyInput, REGION } from '../../utils/region';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPES: Array<{ value: TripType; label: string }> = [
  { value: 'weekend', label: 'Weekend' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'business', label: 'Business' },
];
const MAX_DAYS = 90;
const DAY_MS = 86_400_000;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (d: Date) => d.toLocaleDateString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' });

export function PlanTripScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tripType, setTripType] = useState<TripType>('weekend');
  const [start, setStart] = useState(() => new Date(Date.now() + 7 * DAY_MS));
  const [end, setEnd] = useState(() => new Date(Date.now() + 9 * DAY_MS));
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const [destinations, setDestinations] = useState<string[]>(['']);
  const [budget, setBudget] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [plan, setPlan] = useState<Record<number, string>>({});
  const [groupSize, setGroupSize] = useState(4);
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const dayList = useMemo(() => Array.from({ length: Math.min(Math.max(days, 0), 14) }, (_, i) => i + 1), [days]);
  const places = destinations.map(d => d.trim()).filter(d => d.length >= 2);
  const problem =
    title.trim().length < 3 ? 'Give the trip a title.'
      : places.length === 0 ? 'Add at least one destination.'
        : days < 1 ? 'The trip must end on or after the day it starts.'
          : days > MAX_DAYS ? `A trip can last up to ${MAX_DAYS} days.`
            : '';

  const create = async () => {
    if (problem) return;
    setSaving(true);
    try {
      const trip = await tripService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        tripType,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        destinations: places.map(name => ({ name })),
        budgetPerPerson: budget ? Number(budget) : undefined,
        interests,
        itinerary: dayList.filter(d => plan[d]?.trim()).map(d => ({ day: d, title: plan[d].trim() })),
        maxGroupSize: groupSize,
        visibility: isPublic ? 'public' : 'private',
      });
      navigation.replace('TripDetail', { tripId: trip._id });
    } catch (e) {
      Alert.alert('Not created', errorHandler.process(e).message);
    } finally {
      setSaving(false);
    }
  };

  const input = (value: string, set: (t: string) => void, label: string, extra: object = {}) => (
    <TextInput
      value={value}
      onChangeText={set}
      placeholderTextColor={c.textSec}
      accessibilityLabel={label}
      style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
      {...extra}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Plan a trip</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textSec }]}>Title</Text>
            {input(title, setTitle, 'Title', { placeholder: 'Goa long weekend', maxLength: 100 })}
            <Text style={[styles.label, { color: c.textSec }]}>About the trip (optional)</Text>
            {input(description, setDescription, 'About the trip', { placeholder: 'Beaches by day, seafood by night', multiline: true, maxLength: 2000, style: [styles.input, styles.multi, { borderColor: c.border, color: c.text, backgroundColor: c.bg }] })}
            <View style={styles.chips}>
              {TYPES.map(t => {
                const on = t.value === tripType;
                return (
                  <Pressable key={t.value} onPress={() => setTripType(t.value)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primaryLight : c.bg }]}>
                    <Text style={{ color: on ? c.primary : c.text }}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>When</Text>
            <View style={styles.row}>
              {(['start', 'end'] as const).map(which => (
                <Pressable key={which} onPress={() => setPicking(which)} accessibilityRole="button" accessibilityLabel={`${which === 'start' ? 'From' : 'To'} ${fmt(which === 'start' ? start : end)}`} style={[styles.picker, { borderColor: c.border, backgroundColor: c.bg }]}>
                  <Icon name="calendar" size={18} color={c.primary} />
                  <Text style={{ color: c.text }}>{fmt(which === 'start' ? start : end)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontSize: 13, color: days >= 1 && days <= MAX_DAYS ? c.textSec : c.error }}>
              {days >= 1 ? `${days} ${days === 1 ? 'day' : 'days'}` : 'Choose an end date after the start'}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Destinations and stops</Text>
            {destinations.map((d, i) => (
              <View key={i} style={styles.row}>
                <View style={{ flex: 1 }}>
                  {input(d, t => setDestinations(list => list.map((x, j) => (j === i ? t : x))), `Destination ${i + 1}`, { placeholder: i === 0 ? 'Goa' : 'A stop on the way' })}
                </View>
                {destinations.length > 1 ? (
                  <Pressable onPress={() => setDestinations(list => list.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove destination ${i + 1}`} style={styles.iconBtn}>
                    <Icon name="close" size={20} color={c.textSec} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {destinations.length < 10 ? (
              <Pressable onPress={() => setDestinations(list => [...list, ''])} accessibilityRole="button" style={styles.addRow}>
                <Icon name="plus" size={18} color={c.primary} />
                <Text style={{ color: c.primary, fontWeight: '600' }}>Add a stop</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textSec }]}>Budget per person (US$, optional)</Text>
            {input(budget, t => setBudget(moneyInput(t)), 'Budget per person', { placeholder: '150', keyboardType: 'decimal-pad', maxLength: 8 })}
            <Text style={[styles.cardTitle, { color: c.text }]}>Interests</Text>
            <View style={styles.chips}>
              {TRIP_INTERESTS.map(i => {
                const on = interests.includes(i);
                return (
                  <Pressable key={i} onPress={() => setInterests(list => (on ? list.filter(x => x !== i) : [...list, i]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primaryLight : c.bg }]}>
                    <Text style={{ color: on ? c.primary : c.text }}>{cap(i)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {days >= 1 && days <= MAX_DAYS ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Day by day (optional)</Text>
              {dayList.map(d => (
                <View key={d} style={styles.row}>
                  <Text style={{ width: 52, color: c.textSec }}>Day {d}</Text>
                  <View style={{ flex: 1 }}>
                    {input(plan[d] ?? '', t => setPlan(p => ({ ...p, [d]: t })), `Day ${d} plan`, { placeholder: d === 1 ? 'Arrive, check in, beach' : '', maxLength: 120 })}
                  </View>
                </View>
              ))}
              {days > dayList.length ? <Text style={{ fontSize: 12, color: c.textSec }}>Add the later days once the trip is created.</Text> : null}
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.row}>
              <Text style={{ flex: 1, fontSize: 15, color: c.text }}>Group size, including you</Text>
              <Pressable onPress={() => setGroupSize(n => Math.max(2, n - 1))} accessibilityRole="button" accessibilityLabel="Fewer people" style={[styles.step, { borderColor: c.border }]}>
                <Icon name="minus" size={18} color={c.text} />
              </Pressable>
              <Text style={{ width: 28, textAlign: 'center', fontSize: 17, fontWeight: '700', color: c.text }} accessibilityLiveRegion="polite">{groupSize}</Text>
              <Pressable onPress={() => setGroupSize(n => Math.min(8, n + 1))} accessibilityRole="button" accessibilityLabel="More people" style={[styles.step, { borderColor: c.border }]}>
                <Icon name="plus" size={18} color={c.text} />
              </Pressable>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: c.text }}>Others can find it</Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>{isPublic ? 'Listed in Find travel partners' : 'Only people you share the invite code with'}</Text>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic} accessibilityLabel="Others can find it" trackColor={{ false: c.border, true: c.primary }} />
            </View>
          </View>

          {problem ? <Text style={{ color: c.textSec, fontSize: 13 }}>{problem}</Text> : null}
          <Pressable onPress={create} disabled={Boolean(problem) || saving} accessibilityRole="button" style={[styles.primary, { backgroundColor: problem ? c.border : c.primary }]}>
            {saving ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={{ fontSize: 16, fontWeight: '700', color: problem ? c.textSec : c.textOnPrimary }}>Create trip</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <RideDatePicker
        visible={picking !== null}
        selectedDate={picking === 'end' ? end : start}
        maxDaysAhead={365}
        onSelect={d => {
          if (picking === 'start') {
            setStart(d);
            if (d > end) setEnd(d);
          } else setEnd(d);
        }}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  multi: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  picker: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  step: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
