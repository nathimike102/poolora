/**
 * screens/shared/RaiseDisputeScreen.tsx
 *
 * Report a problem with a booking (UC-A04 step 1). The Poolora team reviews
 * it with the trip's chat, payments and GPS, and both people are told the
 * decision. Riders and drivers use the same form.
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import type { RootStackParamList } from '../../navigation/types';
import { disputeService, type DisputeCategory } from '../../services/disputeService';
import { errorHandler } from '../../utils/errorHandler';
import { REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { tc, tk } from '../../theme/themed';

const CATEGORIES: Array<{ value: DisputeCategory; label: string; hint: string }> = [
  { value: 'payment', get label() { return i18n.t('raiseDispute.categories.payment.label'); }, get hint() { return i18n.t('raiseDispute.categories.payment.hint'); } },
  { value: 'cancellation', get label() { return i18n.t('raiseDispute.categories.cancellation.label'); }, get hint() { return i18n.t('raiseDispute.categories.cancellation.hint'); } },
  { value: 'behavior', get label() { return i18n.t('raiseDispute.categories.behavior.label'); }, get hint() { return i18n.t('raiseDispute.categories.behavior.hint'); } },
  { value: 'route', get label() { return i18n.t('raiseDispute.categories.route.label'); }, get hint() { return i18n.t('raiseDispute.categories.route.hint'); } },
  { value: 'quality', get label() { return i18n.t('raiseDispute.categories.quality.label'); }, get hint() { return i18n.t('raiseDispute.categories.quality.hint'); } },
];

export function RaiseDisputeScreen() {
  const { bookingId, summary } = useRoute<RouteProp<RootStackParamList, 'RaiseDispute'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const ready = Boolean(category) && description.trim().length >= 10;

  const submit = async () => {
    if (!category) return;
    setSending(true);
    try {
      await disputeService.raise({ bookingId, category, description: description.trim() });
      Alert.alert(
        t('raiseDispute.problemReported'),
        t('raiseDispute.ourTeamReviewsReportsWithin'),
        [{ text: t('raiseDispute.ok'), onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(t('raiseDispute.notSent'), errorHandler.process(error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('raiseDispute.reportAProblem')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {summary ? <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{summary}</Text> : null}
        <Text style={[styles.label, tc.color_text]}>{t('raiseDispute.whatWentWrong')}</Text>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {CATEGORIES.map(item => {
            const selected = category === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setCategory(item.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.option,
                  selected ? tc.borderColor_primary : tc.borderColor_border,
                  selected ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                ]}
              >
                <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]}>{item.label}</Text>
                <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{item.hint}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, tc.color_text]}>{t('raiseDispute.tellUsWhatHappened')}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          placeholder={t('raiseDispute.theDriverAskedMeTo')}
          placeholderTextColor={tk.textSec}
          accessibilityLabel={t('raiseDispute.whatHappened')}
          style={[
            styles.input,
            tc.borderColor_surfaceVariant,
            tc.color_text,
            tc.backgroundColor_surfaceVariant
          ]}
        />
        <Text style={[{ fontSize: 13 }, tc.color_textSec]}>
          We look at the trip's chat, payments and route. For an emergency, use SOS or call {REGION.emergency.general} instead.
        </Text>
        <Pressable
          onPress={submit}
          disabled={!ready || sending}
          accessibilityRole="button"
          style={[styles.submit, ready ? tc.backgroundColor_primary : tc.backgroundColor_border]}
        >
          {sending ? <ActivityIndicator color={tk.textOnPrimary} /> : (
            <Text style={[{ fontSize: 16, fontWeight: '700' }, ready ? tc.color_textOnPrimary : tc.color_textSec]}>{t('raiseDispute.sendReport')}</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 14 },
  label: { fontSize: 15, fontWeight: '700' },
  option: { borderWidth: 1.5, borderRadius: 12, padding: 14, gap: 2 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 120, textAlignVertical: 'top', fontSize: 15 },
  submit: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
