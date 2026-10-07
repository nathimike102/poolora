/**
 * screens/shared/SupportTicketScreen.tsx
 *
 * A support request (UC-X02): without an id it is the form for a new one;
 * with an id it shows the thread with the team's replies and lets the user
 * answer back.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import type { RootStackParamList } from '../../navigation/types';
import { supportService, type SupportCategory, type SupportTicket } from '../../services/supportService';
import { errorHandler } from '../../utils/errorHandler';
import { REGION } from '../../utils/region';
import { emergencyNumbers as currentEmergency } from '../../utils/emergencyNumbers';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { tc, tk } from '../../theme/themed';

const CATEGORIES: Array<{ value: SupportCategory; label: string }> = [
  { value: 'safety', get label() { return i18n.t('supportTicket.categories.safety'); } },
  { value: 'payment', get label() { return i18n.t('supportTicket.categories.payment'); } },
  { value: 'account', get label() { return i18n.t('supportTicket.categories.account'); } },
  { value: 'dispute', get label() { return i18n.t('supportTicket.categories.dispute'); } },
  { value: 'technical', get label() { return i18n.t('supportTicket.categories.technical'); } },
  { value: 'feature', get label() { return i18n.t('supportTicket.categories.feature'); } },
  { value: 'feedback', get label() { return i18n.t('supportTicket.categories.feedback'); } },
];

export function SupportTicketScreen() {
  const { ticketId, bookingId } = useRoute<RouteProp<RootStackParamList, 'SupportTicket'>>().params ?? {};
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState<SupportCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!ticketId) return;
      let active = true;
      supportService.get(ticketId).then(t => active && setTicket(t)).catch(() => active && setLoadError(true));
      return () => { active = false; };
    }, [ticketId]),
  );

  const canCreate = Boolean(category) && subject.trim().length >= 3 && message.trim().length >= 10 && !sending;

  const create = async () => {
    if (!category) return;
    setSending(true);
    try {
      const created = await supportService.create({ category, subject: subject.trim(), message: message.trim(), bookingId });
      const urgent = created.priority === 'urgent';
      Alert.alert(
        t('supportTicket.requestSent'),
        urgent
          ? t('supportTicket.urgentSent', { number: currentEmergency().general })
          : t('supportTicket.normalSent'),
        [{ text: t('supportTicket.ok'), onPress: () => navigation.replace('SupportTicket', { ticketId: created._id }) }],
      );
    } catch (error) {
      Alert.alert(t('supportTicket.notSent'), errorHandler.process(error).message);
    } finally {
      setSending(false);
    }
  };

  const reply = async () => {
    if (!ticketId || !message.trim()) return;
    setSending(true);
    try {
      setTicket(await supportService.reply(ticketId, message.trim()));
      setMessage('');
    } catch (error) {
      Alert.alert(t('supportTicket.notSent'), errorHandler.process(error).message);
    } finally {
      setSending(false);
    }
  };

  const title = ticketId ? ticket?.subject ?? t('supportTicket.yourRequest') : t('supportTicket.contactUs');

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={title} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!ticketId ? (
          <>
            <Text style={[styles.label, tc.color_text]}>{t('supportTicket.whatIsItAbout')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {CATEGORIES.map(cat => {
                const selected = category === cat.value;
                return (
                  <Pressable
                    key={cat.value}
                    onPress={() => setCategory(cat.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[
                      styles.chip,
                      selected ? tc.borderColor_primary : tc.borderColor_border,
                      selected ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                    ]}
                  >
                    <Text style={[{ fontSize: 14, fontWeight: selected ? '700' : '400' }, selected ? tc.color_primary : tc.color_text]}>{cat.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {category === 'safety' ? (
              <Text style={[{ fontSize: 13 }, tc.color_error]}>
                If you are in danger now, call {currentEmergency().general}. During a ride, use SOS: it reaches our safety team fastest.
              </Text>
            ) : null}
            <Text style={[styles.label, tc.color_text]}>{t('supportTicket.subject')}</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
              placeholder={t('supportTicket.chargedTwiceForOneTrip')}
              placeholderTextColor={tk.textSec}
              accessibilityLabel={t('supportTicket.subject')}
              style={[
                styles.input,
                tc.borderColor_surfaceVariant,
                tc.color_text,
                tc.backgroundColor_surfaceVariant
              ]}
            />
            <Text style={[styles.label, tc.color_text]}>{t('supportTicket.tellUsMore')}</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={4000}
              placeholder={t('supportTicket.whatHappenedWhenAndOn')}
              placeholderTextColor={tk.textSec}
              accessibilityLabel={t('supportTicket.message')}
              style={[
                styles.input,
                styles.multi,
                tc.borderColor_surfaceVariant,
                tc.color_text,
                tc.backgroundColor_surfaceVariant
              ]}
            />
            <Pressable onPress={create} disabled={!canCreate} accessibilityRole="button" style={[styles.primary, canCreate ? tc.backgroundColor_primary : tc.backgroundColor_border]}>
              {sending ? <ActivityIndicator color={tk.textOnPrimary} /> : (
                <Text style={[{ fontSize: 16, fontWeight: '700' }, canCreate ? tc.color_textOnPrimary : tc.color_textSec]}>{t('supportTicket.send')}</Text>
              )}
            </Pressable>
          </>
        ) : loadError ? (
          <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('supportTicket.thisRequestCouldNotBe')}</Text>
        ) : !ticket ? (
          <ActivityIndicator color={tk.primary} />
        ) : (
          <>
            {ticket.messages.map((m, i) => {
              const mine = m.from === 'user';
              return (
                <View
                  key={i}
                  style={[styles.bubble, mine ? [{ alignSelf: 'flex-end' }, tc.backgroundColor_primaryLight] : [
                    { alignSelf: 'flex-start', borderWidth: 1 },
                    tc.backgroundColor_surfaceVariant,
                    tc.borderColor_surfaceVariant
                  ]]}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '700' }, tc.color_textSec]}>{mine ? t('supportTicket.you') : t('supportTicket.sihamSupport')}</Text>
                  <Text style={[{ fontSize: 15 }, tc.color_text]}>{m.text}</Text>
                  <Text style={[{ fontSize: 11 }, tc.color_textSec]}>{new Date(m.at).toLocaleString(REGION.dateLocale, { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                </View>
              );
            })}
            {ticket.status === 'open' ? (
              <Text style={[{ fontSize: 13, textAlign: 'center' }, tc.color_textSec]}>
                {ticket.priority === 'urgent' ? t('supportTicket.urgentRequestsAreAnsweredFirst') : t('supportTicket.weUsuallyReplyWithinA')}
              </Text>
            ) : null}
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={4000}
              placeholder={ticket.status === 'closed' ? t('supportTicket.writeToReopenThisRequest') : t('supportTicket.addAMessage')}
              placeholderTextColor={tk.textSec}
              accessibilityLabel={t('supportTicket.message')}
              style={[
                styles.input,
                styles.multi,
                tc.borderColor_surfaceVariant,
                tc.color_text,
                tc.backgroundColor_surfaceVariant
              ]}
            />
            <Pressable onPress={reply} disabled={!message.trim() || sending} accessibilityRole="button" style={[styles.primary, message.trim() ? tc.backgroundColor_primary : tc.backgroundColor_border]}>
              {sending ? <ActivityIndicator color={tk.textOnPrimary} /> : (
                <Text style={[{ fontSize: 16, fontWeight: '700' }, message.trim() ? tc.color_textOnPrimary : tc.color_textSec]}>{t('supportTicket.send')}</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
  label: { fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  multi: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  primary: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '85%', borderRadius: 14, padding: 12, gap: 4 },
});
