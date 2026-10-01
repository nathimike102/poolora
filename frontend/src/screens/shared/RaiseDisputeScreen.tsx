/**
 * screens/shared/RaiseDisputeScreen.tsx
 *
 * Report a problem with a booking (UC-A04 step 1). The Poolora team reviews
 * it with the trip's chat, payments and GPS, and both people are told the
 * decision. Riders and drivers use the same form.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { disputeService, type DisputeCategory } from '../../services/disputeService';
import { errorHandler } from '../../utils/errorHandler';
import { REGION } from '../../utils/region';

const CATEGORIES: Array<{ value: DisputeCategory; label: string; hint: string }> = [
  { value: 'payment', label: 'Payment', hint: 'Charged wrongly, or a refund did not arrive' },
  { value: 'cancellation', label: 'Cancellation', hint: 'A cancellation or no-show you disagree with' },
  { value: 'behavior', label: 'Behaviour', hint: 'Rude, unsafe or inappropriate conduct' },
  { value: 'route', label: 'Route or timing', hint: 'Very late, or a detour you did not agree to' },
  { value: 'quality', label: 'Something else', hint: 'Vehicle condition or anything else' },
];

export function RaiseDisputeScreen() {
  const { bookingId, summary } = useRoute<RouteProp<RootStackParamList, 'RaiseDispute'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
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
        'Problem reported',
        'Our team reviews reports within 48 to 72 hours. We will notify you of the decision; any refund goes back the way you paid.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert('Not sent', errorHandler.process(error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Report a problem</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {summary ? <Text style={{ fontSize: 14, color: c.textSec }}>{summary}</Text> : null}
        <Text style={[styles.label, { color: c.text }]}>What went wrong?</Text>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {CATEGORIES.map(item => {
            const selected = category === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setCategory(item.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.option, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primaryLight : c.surface }]}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{item.label}</Text>
                <Text style={{ fontSize: 13, color: c.textSec }}>{item.hint}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, { color: c.text }]}>Tell us what happened</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          placeholder="The driver asked me to cancel because he was running late, and I was charged a fee."
          placeholderTextColor={c.textSec}
          accessibilityLabel="What happened"
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
        />
        <Text style={{ fontSize: 13, color: c.textSec }}>
          We look at the trip's chat, payments and route. For an emergency, use SOS or call {REGION.emergency.general} instead.
        </Text>
        <Pressable
          onPress={submit}
          disabled={!ready || sending}
          accessibilityRole="button"
          style={[styles.submit, { backgroundColor: ready ? c.primary : c.border }]}
        >
          {sending ? <ActivityIndicator color={c.textOnPrimary} /> : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: ready ? c.textOnPrimary : c.textSec }}>Send report</Text>
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
