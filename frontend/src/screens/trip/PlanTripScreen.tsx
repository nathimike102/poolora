/**
 * screens/trip/PlanTripScreen.tsx
 *
 * Plan a group trip (UC-T01): what and where, when, budget, interests, a
 * day-by-day outline, how many can come, and whether others can find it.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Switch, ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { PlaceField } from '../../components/PlaceField';
import { Icon } from '../../components/Icon';
import { RideDatePicker } from '../../components/RideDatePicker';
import { tripService, TRIP_INTERESTS, type TripType } from '../../services/tripService';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';
import { moneyInput, REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Labels are in the catalogue under planTrip.types */
const TYPES: TripType[] = ['weekend', 'vacation', 'business'];
const MAX_DAYS = 90;
const DAY_MS = 86_400_000;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (d: Date) => d.toLocaleDateString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' });

export function PlanTripScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
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
    title.trim().length < 3 ? t('planTrip.problems.title')
      : places.length === 0 ? t('planTrip.problems.destination')
        : days < 1 ? t('planTrip.problems.endBefore')
          : days > MAX_DAYS ? t('planTrip.problems.tooLong', { max: MAX_DAYS })
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
      Alert.alert(t('planTrip.notCreated'), errorHandler.process(e).message);
    } finally {
      setSaving(false);
    }
  };

  const input = (value: string, set: (value: string) => void, label: string, extra: object = {}) => (
    <TextInput
      value={value}
      onChangeText={set}
      placeholderTextColor={tk.textSec}
      accessibilityLabel={label}
      style={[
        styles.input,
        tc.borderColor_border,
        tc.color_text,
        tc.backgroundColor_surface
      ]}
      {...extra}
    />
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('planTrip.planATrip')} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[styles.label, tc.color_textSec]}>{t('planTrip.title')}</Text>
            {input(title, setTitle, t('planTrip.titleLabel'), { placeholder: t('planTrip.titlePlaceholder'), maxLength: 100 })}
            <Text style={[styles.label, tc.color_textSec]}>{t('planTrip.aboutTheTripOptional')}</Text>
            {input(description, setDescription, t('planTrip.aboutLabel'), { placeholder: t('planTrip.aboutPlaceholder'), multiline: true, maxLength: 2000, style: [
              styles.input,
              styles.multi,
              tc.borderColor_border,
              tc.color_text,
              tc.backgroundColor_surface
            ] })}
            <View style={styles.chips}>
              {TYPES.map(value => ({ value, label: t(`planTrip.types.${value}`) })).map(type => {
                const on = type.value === tripType;
                return (
                  <Pressable key={type.value} onPress={() => setTripType(type.value)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[
                    styles.chip,
                    on ? tc.borderColor_primary : tc.borderColor_border,
                    on ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                  ]}>
                    <Text style={on ? tc.color_primary : tc.color_text}>{type.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[styles.cardTitle, tc.color_text]}>{t('planTrip.when')}</Text>
            <View style={styles.row}>
              {(['start', 'end'] as const).map(which => (
                <Pressable key={which} onPress={() => setPicking(which)} accessibilityRole="button" accessibilityLabel={`${which === 'start' ? t('planTrip.from') : t('planTrip.to')} ${fmt(which === 'start' ? start : end)}`} style={[styles.picker, tc.borderColor_border, tc.backgroundColor_surface]}>
                  <Icon name="calendar" size={18} color={tk.primary} />
                  <Text style={tc.color_text}>{fmt(which === 'start' ? start : end)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[
              { fontSize: 13 },
              days >= 1 && days <= MAX_DAYS ? tc.color_textSec : tc.color_error
            ]}>
              {days >= 1 ? (days === 1 ? t('planTrip.dayOne') : t('planTrip.dayMany', { count: days })) : t('planTrip.endAfterStart')}
            </Text>
          </View>

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[styles.cardTitle, tc.color_text]}>{t('planTrip.destinationsAndStops')}</Text>
            {destinations.map((d, i) => (
              <View key={i} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <PlaceField
                    label={t('planTrip.destination', { n: i + 1 })}
                    value={d}
                    onChange={value => setDestinations(list => list.map((x, j) => (j === i ? value : x)))}
                    placeholder={i === 0 ? t('planTrip.firstPlaceholder') : t('planTrip.aStopOnTheWay')}
                  />
                </View>
                {destinations.length > 1 ? (
                  <Pressable onPress={() => setDestinations(list => list.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('planTrip.removeDestination', { n: i + 1 })} style={styles.iconBtn}>
                    <Icon name="close" size={20} color={tk.textSec} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {destinations.length < 10 ? (
              <Pressable onPress={() => setDestinations(list => [...list, ''])} accessibilityRole="button" style={styles.addRow}>
                <Icon name="plus" size={18} color={tk.primary} />
                <Text style={[{ fontWeight: '600' }, tc.color_primary]}>{t('planTrip.addAStop')}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[styles.label, tc.color_textSec]}>{t('planTrip.budgetPerPersonUsOptional')}</Text>
            {input(budget, value => setBudget(moneyInput(value)), t('planTrip.budget'), { placeholder: '150', keyboardType: 'decimal-pad', maxLength: 8 })}
            <Text style={[styles.cardTitle, tc.color_text]}>{t('planTrip.interests')}</Text>
            <View style={styles.chips}>
              {TRIP_INTERESTS.map(i => {
                const on = interests.includes(i);
                return (
                  <Pressable key={i} onPress={() => setInterests(list => (on ? list.filter(x => x !== i) : [...list, i]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[
                    styles.chip,
                    on ? tc.borderColor_primary : tc.borderColor_border,
                    on ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                  ]}>
                    <Text style={on ? tc.color_primary : tc.color_text}>{cap(i)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {days >= 1 && days <= MAX_DAYS ? (
            <View style={[
              styles.card,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}>
              <Text style={[styles.cardTitle, tc.color_text]}>{t('planTrip.dayByDayOptional')}</Text>
              {dayList.map(d => (
                <View key={d} style={styles.row}>
                  <Text style={[{ width: 52 }, tc.color_textSec]}>{t('planTrip.day', { n: d })}</Text>
                  <View style={{ flex: 1 }}>
                    {input(plan[d] ?? '', value => setPlan(p => ({ ...p, [d]: value })), t('planTrip.dayPlan', { n: d }), { placeholder: d === 1 ? t('planTrip.dayOnePlaceholder') : '', maxLength: 120 })}
                  </View>
                </View>
              ))}
              {days > dayList.length ? <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{t('planTrip.addTheLaterDaysOnce')}</Text> : null}
            </View>
          ) : null}

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <View style={styles.row}>
              <Text style={[{ flex: 1, fontSize: 15 }, tc.color_text]}>{t('planTrip.groupSizeIncludingYou')}</Text>
              <Pressable onPress={() => setGroupSize(n => Math.max(2, n - 1))} accessibilityRole="button" accessibilityLabel={t('planTrip.fewerPeople')} style={[styles.step, tc.borderColor_border]}>
                <Icon name="minus" size={18} color={tk.text} />
              </Pressable>
              <Text style={[{ width: 28, textAlign: 'center', fontSize: 17, fontWeight: '700' }, tc.color_text]} accessibilityLiveRegion="polite">{groupSize}</Text>
              <Pressable onPress={() => setGroupSize(n => Math.min(8, n + 1))} accessibilityRole="button" accessibilityLabel={t('planTrip.morePeople')} style={[styles.step, tc.borderColor_border]}>
                <Icon name="plus" size={18} color={tk.text} />
              </Pressable>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 15 }, tc.color_text]}>{t('planTrip.othersCanFindIt')}</Text>
                <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{isPublic ? t('planTrip.listedInFindTravelPartners') : t('planTrip.onlyPeopleYouShareThe')}</Text>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic} accessibilityLabel={t('planTrip.othersCanFindIt')} trackColor={{ false: tk.border, true: tk.primary }} />
            </View>
          </View>

          {problem ? <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{problem}</Text> : null}
          <Pressable onPress={create} disabled={Boolean(problem) || saving} accessibilityRole="button" style={[styles.primary, problem ? tc.backgroundColor_border : tc.backgroundColor_primary]}>
            {saving ? <ActivityIndicator color={tk.textOnPrimary} /> : <Text style={[{ fontSize: 16, fontWeight: '700' }, problem ? tc.color_textSec : tc.color_textOnPrimary]}>{t('planTrip.createTrip')}</Text>}
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
