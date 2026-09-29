/**
 * screens/shared/AppealScreen.tsx
 *
 * The account's standing and appeals (UC-A05 3a). Opened from Help by a
 * suspended user, or shown in place of the whole app when the account is
 * blocked or was merged into another (then `restriction` is set and the
 * only way out is to sign out).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { appealService, type AccountStanding } from '../../services/appealService';
import { errorHandler } from '../../utils/errorHandler';
import type { AccountRestriction } from '../../utils/accountRestriction';
import { REGION } from '../../utils/region';

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const OUTCOME = { open: 'Being reviewed', upheld: 'Decision kept', overturned: 'Decision lifted' } as const;

export function AppealScreen({ restriction, onSignOut }: { restriction?: AccountRestriction; onSignOut?: () => void } = {}) {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const merged = restriction?.id === 'ACCOUNT_MERGED';
  const [standing, setStanding] = useState<AccountStanding | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (merged) return;
    try {
      setStanding(await appealService.mine());
      setError('');
    } catch (e) {
      setError(errorHandler.process(e).message);
    }
  }, [merged]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    setSending(true);
    try {
      await appealService.file(message.trim());
      setMessage('');
      await load();
    } catch (e) {
      setError(errorHandler.process(e).message);
    } finally {
      setSending(false);
    }
  };

  const title = merged ? 'Account merged' : standing?.status === 'blocked' ? 'Account blocked' : standing?.status === 'suspended' ? 'Account suspended' : 'Account status';

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        {restriction ? <View style={{ width: 44 }} /> : <BackButton onPress={() => navigation.goBack()} />}
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{title}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {merged ? (
          <Text style={{ fontSize: 15, color: c.text, lineHeight: 22 }}>{restriction?.message}</Text>
        ) : !standing && !error ? (
          <ActivityIndicator color={c.primary} />
        ) : standing ? (
          <>
            {standing.status === 'active' ? (
              <Text style={{ fontSize: 15, color: c.text }}>Your account is in good standing. There is nothing to appeal.</Text>
            ) : (
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
                  {standing.status === 'blocked' ? 'This account is blocked.' : `This account is suspended${standing.suspendedUntil ? ` until ${day(standing.suspendedUntil)}` : ''}.`}
                </Text>
                {standing.reason ? <Text style={{ fontSize: 14, color: c.text }}>Reason: {standing.reason}</Text> : null}
                {standing.status === 'suspended' ? <Text style={{ fontSize: 13, color: c.textSec }}>You can still see your rides, but cannot post or book.</Text> : null}
              </View>
            )}

            {standing.canAppeal ? (
              <View style={{ gap: 8 }}>
                <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">Appeal</Text>
                <Text style={{ fontSize: 13, color: c.textSec }}>
                  An admin who was not part of the decision reviews it, usually within 3 working days.{standing.appealDeadline ? ` Appeal by ${day(standing.appealDeadline)}.` : ''}
                </Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={2000}
                  placeholder="What happened, and why the decision should change. Mention any receipts or messages that show it."
                  placeholderTextColor={c.textSec}
                  accessibilityLabel="Your appeal"
                  style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
                />
                <Text style={{ fontSize: 12, color: c.textSec }}>{message.trim().length < 20 ? `At least ${20 - message.trim().length} more characters` : `${message.length} / 2000`}</Text>
                <Pressable onPress={send} disabled={message.trim().length < 20 || sending} accessibilityRole="button" style={[styles.primary, { backgroundColor: message.trim().length >= 20 ? c.primary : c.border }]}>
                  {sending ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>Send appeal</Text>}
                </Pressable>
              </View>
            ) : null}

            {standing.appeals.length ? (
              <View style={{ gap: 8 }}>
                <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">Your appeals</Text>
                {standing.appeals.map(a => (
                  <View key={a._id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: a.status === 'overturned' ? c.success : c.text }}>{OUTCOME[a.status]}</Text>
                    <Text style={{ fontSize: 13, color: c.textSec }}>Sent {day(a.createdAt)}</Text>
                    {a.decisionNote ? <Text style={{ fontSize: 14, color: c.text }}>{a.decisionNote}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
        {error ? <Text style={{ color: c.error }} accessibilityRole="alert">{error}</Text> : null}

        {onSignOut ? (
          <Pressable onPress={onSignOut} accessibilityRole="button" style={[styles.secondary, { borderColor: c.border }]}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Sign out</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  input: { minHeight: 140, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, textAlignVertical: 'top' },
  primary: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondary: { minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
