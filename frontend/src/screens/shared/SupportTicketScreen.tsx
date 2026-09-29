/**
 * screens/shared/SupportTicketScreen.tsx
 *
 * A support request (UC-X02): without an id it is the form for a new one;
 * with an id it shows the thread with the team's replies and lets the user
 * answer back.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { supportService, type SupportCategory, type SupportTicket } from '../../services/supportService';
import { errorHandler } from '../../utils/errorHandler';

const CATEGORIES: Array<{ value: SupportCategory; label: string }> = [
  { value: 'safety', label: 'Safety concern' },
  { value: 'payment', label: 'Payment problem' },
  { value: 'account', label: 'My account' },
  { value: 'dispute', label: 'A problem with a trip' },
  { value: 'technical', label: 'The app is not working' },
  { value: 'feature', label: 'Feature request' },
  { value: 'feedback', label: 'General feedback' },
];

export function SupportTicketScreen() {
  const { ticketId, bookingId } = useRoute<RouteProp<RootStackParamList, 'SupportTicket'>>().params ?? {};
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
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
        'Request sent',
        urgent
          ? 'Safety and payment requests are answered first. If you are in danger, call 999.'
          : 'We usually reply within a day. You will get a notification and an email.',
        [{ text: 'OK', onPress: () => navigation.replace('SupportTicket', { ticketId: created._id }) }],
      );
    } catch (error) {
      Alert.alert('Not sent', errorHandler.process(error).message);
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
      Alert.alert('Not sent', errorHandler.process(error).message);
    } finally {
      setSending(false);
    }
  };

  const title = ticketId ? ticket?.subject ?? 'Your request' : 'Contact us';

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!ticketId ? (
          <>
            <Text style={[styles.label, { color: c.text }]}>What is it about?</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {CATEGORIES.map(cat => {
                const selected = category === cat.value;
                return (
                  <Pressable
                    key={cat.value}
                    onPress={() => setCategory(cat.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primaryLight : c.surface }]}
                  >
                    <Text style={{ fontSize: 14, color: selected ? c.primary : c.text, fontWeight: selected ? '700' : '400' }}>{cat.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {category === 'safety' ? (
              <Text style={{ fontSize: 13, color: c.error }}>
                If you are in danger now, call 999. During a ride, use SOS: it reaches our safety team fastest.
              </Text>
            ) : null}
            <Text style={[styles.label, { color: c.text }]}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
              placeholder="Charged twice for one trip"
              placeholderTextColor={c.textSec}
              accessibilityLabel="Subject"
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
            />
            <Text style={[styles.label, { color: c.text }]}>Tell us more</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={4000}
              placeholder="What happened, when, and on which trip"
              placeholderTextColor={c.textSec}
              accessibilityLabel="Message"
              style={[styles.input, styles.multi, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
            />
            <Pressable onPress={create} disabled={!canCreate} accessibilityRole="button" style={[styles.primary, { backgroundColor: canCreate ? c.primary : c.border }]}>
              {sending ? <ActivityIndicator color={c.textOnPrimary} /> : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: canCreate ? c.textOnPrimary : c.textSec }}>Send</Text>
              )}
            </Pressable>
          </>
        ) : loadError ? (
          <Text style={{ fontSize: 14, color: c.textSec }}>This request could not be loaded. Go back and try again.</Text>
        ) : !ticket ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <>
            {ticket.messages.map((m, i) => {
              const mine = m.from === 'user';
              return (
                <View
                  key={i}
                  style={[styles.bubble, mine ? { alignSelf: 'flex-end', backgroundColor: c.primaryLight } : { alignSelf: 'flex-start', backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: c.textSec }}>{mine ? 'You' : 'Poolora support'}</Text>
                  <Text style={{ fontSize: 15, color: c.text }}>{m.text}</Text>
                  <Text style={{ fontSize: 11, color: c.textSec }}>{new Date(m.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                </View>
              );
            })}
            {ticket.status === 'open' ? (
              <Text style={{ fontSize: 13, color: c.textSec, textAlign: 'center' }}>
                {ticket.priority === 'urgent' ? 'Urgent requests are answered first.' : 'We usually reply within a day.'}
              </Text>
            ) : null}
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={4000}
              placeholder={ticket.status === 'closed' ? 'Write to reopen this request' : 'Add a message'}
              placeholderTextColor={c.textSec}
              accessibilityLabel="Message"
              style={[styles.input, styles.multi, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
            />
            <Pressable onPress={reply} disabled={!message.trim() || sending} accessibilityRole="button" style={[styles.primary, { backgroundColor: message.trim() ? c.primary : c.border }]}>
              {sending ? <ActivityIndicator color={c.textOnPrimary} /> : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: message.trim() ? c.textOnPrimary : c.textSec }}>Send</Text>
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
