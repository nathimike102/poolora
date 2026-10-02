/**
 * screens/shared/HelpScreen.tsx
 *
 * Help and support (UC-X02): answers to common questions, a phone line for
 * urgent safety and payment problems, a request form, and the user's earlier
 * requests with the team's replies.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Linking, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { COMPANY } from '../../config/company';
import type { RootStackParamList } from '../../navigation/types';
import { supportService, type SupportTicket } from '../../services/supportService';
import { REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Answers kept in the app so they work offline. Keep in line with the backend rules. */
const FAQ_SIZES = [5, 5, 3, 4];
const faqVars = () => ({ ambulance: REGION.emergency.ambulance, number: REGION.emergency.general, police: REGION.emergency.police });
// The words are in the catalogue under help.faq (topic, then q1/a1, q2/a2…), read when shown
const FAQ: Array<{ topic: string; items: Array<{ q: string; a: string }> }> = FAQ_SIZES.map((size, ti) => ({
  get topic() { return i18n.t(`help.faq.t${ti + 1}.topic`); },
  items: Array.from({ length: size }, (_, qi) => ({
    get q() { return i18n.t(`help.faq.t${ti + 1}.q${qi + 1}`, faqVars()); },
    get a() { return i18n.t(`help.faq.t${ti + 1}.a${qi + 1}`, faqVars()); },
  })),
}));


export function HelpScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [assistantOn, setAssistantOn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      supportService.mine().then(t => active && setTickets(t)).catch(() => active && setTickets([]));
      supportService.assistantEnabled().then(on => active && setAssistantOn(on)).catch(() => undefined);
      return () => { active = false; };
    }, []),
  );

  const faq = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ;
    return FAQ.map(topic => ({ ...topic, items: topic.items.filter(i => `${i.q} ${i.a}`.toLowerCase().includes(q)) })).filter(topic => topic.items.length);
  }, [query]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{t('help.help')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Urgent line (UC-X02: phone support for safety and payment) */}
        <View style={[styles.urgent, { backgroundColor: c.errorLight }]}>
          <Icon name="phone-alert" size={22} color={c.error} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{t('help.urgentSafetyOrPaymentProblem')}</Text>
            <Text style={{ fontSize: 13, color: c.text }}>{t('help.callUs', { phone: COMPANY.supportPhoneDisplay, number: REGION.emergency.general })}</Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(`tel:${COMPANY.supportPhone}`)}
            accessibilityRole="button"
            accessibilityLabel={t('help.callLabel', { phone: COMPANY.supportPhoneDisplay })}
            style={[styles.callBtn, { backgroundColor: c.error }]}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('help.call')}</Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('help.searchHelp')}
          placeholderTextColor={c.textSec}
          accessibilityLabel={t('help.searchHelp')}
          style={[styles.search, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
        />

        {faq.length === 0 ? (
          <Text style={{ fontSize: 14, color: c.textSec }}>{t('help.noMatches', { query: query.trim() })}</Text>
        ) : faq.map(topic => (
          <View key={topic.topic} style={{ gap: 6 }}>
            <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">{topic.topic}</Text>
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              {topic.items.map((item, i) => {
                const open = openQ === item.q || Boolean(query.trim());
                return (
                  <View key={item.q} style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : null}>
                    <Pressable
                      onPress={() => setOpenQ(openQ === item.q ? null : item.q)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      style={styles.qRow}
                    >
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: c.text }}>{item.q}</Text>
                      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.textSec} />
                    </Pressable>
                    {open ? <Text style={[styles.answer, { color: c.textSec }]}>{item.a}</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">{t('help.stillNeedHelp')}</Text>
        {assistantOn ? (
          <Pressable
            onPress={() => navigation.navigate('SupportAssistant')}
            accessibilityRole="button"
            style={[styles.primary, styles.outline, { borderColor: c.primary }]}
          >
            <Icon name="robot-happy-outline" size={20} color={c.primary} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.primary }}>{t('help.askTheAssistant')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => navigation.navigate('SupportTicket', {})}
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: c.primary }]}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>{t('help.contactUs')}</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`mailto:${COMPANY.supportEmail}`)} accessibilityRole="link" style={styles.link}>
          <Text style={{ fontSize: 14, color: c.primary }}>{t('help.orEmail', { email: COMPANY.supportEmail })}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Appeal')} accessibilityRole="button" style={styles.link}>
          <Text style={{ fontSize: 14, color: c.primary }}>{t('help.appealASuspensionOrBlock')}</Text>
        </Pressable>

        <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">{t('help.yourRequests')}</Text>
        {tickets === null ? <ActivityIndicator color={c.primary} /> : tickets.length === 0 ? (
          <Text style={{ fontSize: 14, color: c.textSec }}>{t('help.requestsYouSendAppearHere')}</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {tickets.map((ticket, i) => (
              <Pressable
                key={ticket._id}
                onPress={() => navigation.navigate('SupportTicket', { ticketId: ticket._id })}
                accessibilityRole="button"
                style={[styles.qRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }} numberOfLines={1}>{ticket.subject}</Text>
                  <Text style={{ fontSize: 13, color: ticket.status === 'answered' ? c.primary : c.textSec }}>
                    {t(`help.status.${ticket.status}`)} · {new Date(ticket.updatedAt).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={c.textSec} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14 },
  callBtn: { minHeight: 44, minWidth: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10 },
  answer: { fontSize: 14, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14 },
  primary: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  outline: { flexDirection: 'row', gap: 8, borderWidth: 1.5 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
