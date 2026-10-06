/**
 * screens/shared/HelpScreen.tsx
 *
 * Help and support (UC-X02): answers to common questions, a phone line for
 * urgent safety and payment problems, a request form, and the user's earlier
 * requests with the team's replies.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { COMPANY } from '../../config/company';
import type { RootStackParamList } from '../../navigation/types';
import { supportService, type SupportTicket } from '../../services/supportService';
import { REGION, formatPhone } from '../../utils/region';

const supportPhone = REGION.supportPhone;
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

import { tc, tk } from '../../theme/themed';

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
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('help.help')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Urgent line (UC-X02: phone support for safety and payment). Only a local
            number is shown; until the market has one, an urgent request instead. */}
        <View style={[styles.urgent, tc.backgroundColor_errorLight]}>
          <Icon name="phone-alert" size={22} color={tk.error} />
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]}>{t('help.urgentSafetyOrPaymentProblem')}</Text>
            <Text style={[{ fontSize: 13 }, tc.color_text]}>
              {supportPhone
                ? t('help.callUs', { phone: formatPhone(supportPhone), number: REGION.emergency.general })
                : t('help.reportUrgent', { number: REGION.emergency.general })}
            </Text>
          </View>
          {supportPhone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${supportPhone}`)}
              accessibilityRole="button"
              accessibilityLabel={t('help.callLabel', { phone: formatPhone(supportPhone) })}
              style={[styles.callBtn, tc.backgroundColor_error]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('help.call')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => navigation.navigate('SupportTicket', {})}
              accessibilityRole="button"
              style={[styles.callBtn, tc.backgroundColor_error]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('help.report')}</Text>
            </Pressable>
          )}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('help.searchHelp')}
          placeholderTextColor={tk.textSec}
          accessibilityLabel={t('help.searchHelp')}
          style={[
            styles.search,
            tc.borderColor_surfaceVariant,
            tc.color_text,
            tc.backgroundColor_surfaceVariant
          ]}
        />

        {faq.length === 0 ? (
          <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('help.noMatches', { query: query.trim() })}</Text>
        ) : faq.map(topic => (
          <View key={topic.topic} style={{ gap: 6 }}>
            <Text style={[styles.section, tc.color_text]} accessibilityRole="header">{topic.topic}</Text>
            <View style={[
              styles.card,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}>
              {topic.items.map((item, i) => {
                const open = openQ === item.q || Boolean(query.trim());
                return (
                  <View key={item.q} style={i > 0 ? [{ borderTopWidth: 1 }, tc.borderTopColor_border] : null}>
                    <Pressable
                      onPress={() => setOpenQ(openQ === item.q ? null : item.q)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      style={styles.qRow}
                    >
                      <Text style={[{ flex: 1, fontSize: 15, fontWeight: '600' }, tc.color_text]}>{item.q}</Text>
                      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={tk.textSec} />
                    </Pressable>
                    {open ? <Text style={[styles.answer, tc.color_textSec]}>{item.a}</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={[styles.section, tc.color_text]} accessibilityRole="header">{t('help.stillNeedHelp')}</Text>
        {assistantOn ? (
          <Pressable
            onPress={() => navigation.navigate('SupportAssistant')}
            accessibilityRole="button"
            style={[styles.primary, styles.outline, tc.borderColor_primary]}
          >
            <Icon name="robot-happy-outline" size={20} color={tk.primary} />
            <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_primary]}>{t('help.askTheAssistant')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => navigation.navigate('SupportTicket', {})}
          accessibilityRole="button"
          style={[styles.primary, tc.backgroundColor_primary]}
        >
          <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_textOnPrimary]}>{t('help.contactUs')}</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`mailto:${COMPANY.supportEmail}`)} accessibilityRole="link" style={styles.link}>
          <Text style={[{ fontSize: 14 }, tc.color_primary]}>{t('help.orEmail', { email: COMPANY.supportEmail })}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Appeal')} accessibilityRole="button" style={styles.link}>
          <Text style={[{ fontSize: 14 }, tc.color_primary]}>{t('help.appealASuspensionOrBlock')}</Text>
        </Pressable>

        <Text style={[styles.section, tc.color_text]} accessibilityRole="header">{t('help.yourRequests')}</Text>
        {tickets === null ? <ActivityIndicator color={tk.primary} /> : tickets.length === 0 ? (
          <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('help.requestsYouSendAppearHere')}</Text>
        ) : (
          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            {tickets.map((ticket, i) => (
              <Pressable
                key={ticket._id}
                onPress={() => navigation.navigate('SupportTicket', { ticketId: ticket._id })}
                accessibilityRole="button"
                style={[styles.qRow, i > 0 && [{ borderTopWidth: 1 }, tc.borderTopColor_border]]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 15, fontWeight: '600' }, tc.color_text]} numberOfLines={1}>{ticket.subject}</Text>
                  <Text style={[
                    { fontSize: 13 },
                    ticket.status === 'answered' ? tc.color_primary : tc.color_textSec
                  ]}>
                    {t(`help.status.${ticket.status}`)} · {new Date(ticket.updatedAt).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={tk.textSec} />
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
