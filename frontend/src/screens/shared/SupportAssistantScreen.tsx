/**
 * screens/shared/SupportAssistantScreen.tsx
 *
 * The in-app support assistant (UC-X02 chatbot). It answers from the help
 * answers and the user's own bookings, and opens a support request for
 * anything a person needs to settle. The conversation lives only on this
 * screen and is sent with each message.
 */
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { supportService, type AssistantTurn } from '../../services/supportService';
import { errorHandler } from '../../utils/errorHandler';

type Turn = AssistantTurn & { ticketId?: string };

const GREETING = 'Hi, I can answer questions about bookings, payments, refunds and your account, and check your recent trips. What do you need?';
const SUGGESTIONS = ['How much do I get back if I cancel?', 'Where did my refund go?', 'My payment went through but my request disappeared'];
/** The server keeps at most this many turns */
const MAX_TURNS = 40;

export function SupportAssistantScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || thinking) return;
    const next = [...turns, { role: 'user' as const, text: message }];
    setTurns(next);
    setDraft('');
    setFailed(null);
    setThinking(true);
    try {
      const history = next.slice(-MAX_TURNS).map(({ role, text: t }) => ({ role, text: t }));
      const { reply, ticketId } = await supportService.askAssistant(history);
      setTurns(t => [...t, { role: 'assistant', text: reply, ticketId }]);
    } catch (error) {
      setFailed(errorHandler.process(error).message);
    } finally {
      setThinking(false);
    }
  };

  const bubble = (t: Turn, key: React.Key) => {
    const mine = t.role === 'user';
    return (
      <View
        key={key}
        style={[styles.bubble, mine ? { alignSelf: 'flex-end', backgroundColor: c.primaryLight } : { alignSelf: 'flex-start', backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: c.textSec }}>{mine ? 'You' : 'Poolora assistant'}</Text>
        <Text style={{ fontSize: 15, lineHeight: 21, color: c.text }}>{t.text}</Text>
        {t.ticketId ? (
          <Pressable
            onPress={() => navigation.navigate('SupportTicket', { ticketId: t.ticketId })}
            accessibilityRole="button"
            style={styles.ticketLink}
          >
            <Icon name="ticket-outline" size={16} color={c.primary} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>Open the support request</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Assistant</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {bubble({ role: 'assistant', text: GREETING }, 'greeting')}
        {turns.length === 0 ? (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map(s => (
              <Pressable key={s} onPress={() => send(s)} accessibilityRole="button" style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Text style={{ fontSize: 14, color: c.text }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {turns.map(bubble)}
        {thinking ? (
          <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]} accessibilityLabel="The assistant is writing">
            <ActivityIndicator color={c.primary} />
          </View>
        ) : null}
        {failed ? (
          <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
            <Text style={{ fontSize: 14, color: c.error }}>{failed}</Text>
            <Pressable onPress={() => navigation.navigate('SupportTicket', {})} accessibilityRole="button" style={styles.link}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>Contact a person instead</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={{ fontSize: 12, color: c.textSec, textAlign: 'center' }}>
          The assistant can make mistakes. It never changes a booking or moves money; a person handles anything it passes on.
        </Text>
      </ScrollView>
      <View style={[styles.composer, { borderTopColor: c.border, backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={4000}
          placeholder="Ask a question"
          placeholderTextColor={c.textSec}
          accessibilityLabel="Message to the assistant"
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
        />
        <Pressable
          onPress={() => send(draft)}
          disabled={!draft.trim() || thinking}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[styles.send, { backgroundColor: draft.trim() && !thinking ? c.primary : c.border }]}
        >
          <Icon name="send" size={20} color={draft.trim() && !thinking ? c.textOnPrimary : c.textSec} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 12, paddingBottom: 24 },
  bubble: { maxWidth: '88%', borderRadius: 14, padding: 12, gap: 4 },
  suggestions: { gap: 8, alignItems: 'flex-end' },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', maxWidth: '88%' },
  ticketLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  link: { minHeight: 44, justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 48, maxHeight: 140, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, fontSize: 15, textAlignVertical: 'top' },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
