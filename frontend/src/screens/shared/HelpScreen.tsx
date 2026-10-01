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

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Answers kept in the app so they work offline. Keep in line with the backend rules. */
const FAQ: Array<{ topic: string; items: Array<{ q: string; a: string }> }> = [
  {
    topic: 'Booking and payment',
    items: [
      { q: 'When is my seat confirmed?', a: 'When the driver accepts your request. Drivers have 6 hours to answer; a request that is not answered in time, or once the ride has left, expires and any payment is refunded in full.' },
      { q: 'I paid but my request disappeared', a: 'A request paid by EcoCash, OneMoney, InnBucks or card that is not paid within 15 minutes is cancelled. If the payment goes through after that, it lands in your Poolora wallet. If money left your account and is not in your wallet, open a request under Payment below and we will trace it.' },
      { q: 'How much do I get back if I cancel?', a: 'Before the driver accepts, everything. After that, by default: everything 24 hours or more before departure, half from 2 hours, and nothing after that. Cancelling within 30 minutes of the driver accepting is free, as long as the ride is an hour or more away. The app shows the exact amount before you confirm. If the driver changes the time or cancels, you get everything back.' },
      { q: 'Where do refunds go?', a: 'To your Poolora wallet, at once, however you paid. Use it for your next ride, or withdraw it to EcoCash, OneMoney or InnBucks under Settings, Wallet; a person sends withdrawals, usually within one working day.' },
      { q: 'Can I pay in ZiG?', a: 'Yes, when ZiG is offered on the payment screen. Prices are set in US dollars and converted at the rate shown before you pay.' },
    ],
  },
  {
    topic: 'During a ride',
    items: [
      { q: 'How do I share my trip?', a: 'On the ride screen, tap Share trip. Anyone with the link can follow the car without the app until an hour after you arrive.' },
      { q: 'What does SOS do?', a: `Hold the SOS button for 3 seconds. The Poolora safety team is alerted at once and can see where you are. Ten seconds later your emergency contacts get a text with a link to your live location, unless you cancel because you pressed it by accident. If you are in danger, also call ${REGION.emergency.general} (police ${REGION.emergency.police}, ambulance ${REGION.emergency.ambulance}).` },
      { q: 'What if I have no signal or no GPS?', a: 'The alert still goes: without a GPS fix we use the car\'s last position. With no data at all, the app keeps trying and offers to text your contacts from your phone and to call the emergency line.' },
      { q: 'Why am I asked "Are you OK?"', a: 'During longer rides we check in every 30 minutes. If you do not answer twice, our safety team is alerted, and if you still do not answer within 5 minutes we text your emergency contacts.' },
      { q: 'The driver did not come', a: 'If the driver cancels, you are refunded in full automatically. If they never arrived, tap the trip in My rides and choose Report a problem.' },
    ],
  },
  {
    topic: 'After a ride',
    items: [
      { q: 'How do I rate a trip?', a: 'Right after the ride, or later from My rides; trips you have not rated are marked Rate. Ratings close 7 days after the trip. Written reviews appear after our team checks them.' },
      { q: 'How do I get a receipt?', a: 'In My rides, tap the trip and choose Receipt. You can also email it to yourself.' },
      { q: 'Something went wrong on my trip', a: 'Tap the trip in My rides and choose Report a problem. Our team reviews it within 48 to 72 hours with the trip\'s chat, payments and route.' },
    ],
  },
  {
    topic: 'Driving with Poolora',
    items: [
      { q: 'How long does verification take?', a: 'We review your licence, registration and insurance within 48 hours. If something is unclear we ask you to upload that document again.' },
      { q: 'How is the seat price set?', a: 'We suggest a price from the distance and your vehicle, with a little more at commute times and when demand is high. You can choose anything within 30% of it.' },
      { q: 'How do I get the Verified badge?', a: 'Approved documents, 20 trips, a rating of 4.7 or more from at least 10 riders, few cancellations, 90 days with us and a clean record. Your profile shows your progress.' },
      { q: 'When am I paid?', a: 'Your share of each fare is added when you complete the ride. Monthly statements are on the Earnings screen.' },
    ],
  },
];

const STATUS: Record<SupportTicket['status'], string> = { open: 'Waiting for us', answered: 'We replied', closed: 'Closed' };

export function HelpScreen() {
  const navigation = useNavigation<Nav>();
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
    return FAQ.map(t => ({ ...t, items: t.items.filter(i => `${i.q} ${i.a}`.toLowerCase().includes(q)) })).filter(t => t.items.length);
  }, [query]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Help</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Urgent line (UC-X02: phone support for safety and payment) */}
        <View style={[styles.urgent, { backgroundColor: c.errorLight }]}>
          <Icon name="phone-alert" size={22} color={c.error} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Urgent safety or payment problem?</Text>
            <Text style={{ fontSize: 13, color: c.text }}>Call us on {COMPANY.supportPhoneDisplay}. In danger now? Call {REGION.emergency.general}.</Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(`tel:${COMPANY.supportPhone}`)}
            accessibilityRole="button"
            accessibilityLabel={`Call Poolora support on ${COMPANY.supportPhoneDisplay}`}
            style={[styles.callBtn, { backgroundColor: c.error }]}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Call</Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search help"
          placeholderTextColor={c.textSec}
          accessibilityLabel="Search help"
          style={[styles.search, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
        />

        {faq.length === 0 ? (
          <Text style={{ fontSize: 14, color: c.textSec }}>No answers match "{query.trim()}". Ask us below.</Text>
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

        <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">Still need help?</Text>
        {assistantOn ? (
          <Pressable
            onPress={() => navigation.navigate('SupportAssistant')}
            accessibilityRole="button"
            style={[styles.primary, styles.outline, { borderColor: c.primary }]}
          >
            <Icon name="robot-happy-outline" size={20} color={c.primary} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.primary }}>Ask the assistant</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => navigation.navigate('SupportTicket', {})}
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: c.primary }]}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>Contact us</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`mailto:${COMPANY.supportEmail}`)} accessibilityRole="link" style={styles.link}>
          <Text style={{ fontSize: 14, color: c.primary }}>Or email {COMPANY.supportEmail}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Appeal')} accessibilityRole="button" style={styles.link}>
          <Text style={{ fontSize: 14, color: c.primary }}>Appeal a suspension or block</Text>
        </Pressable>

        <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">Your requests</Text>
        {tickets === null ? <ActivityIndicator color={c.primary} /> : tickets.length === 0 ? (
          <Text style={{ fontSize: 14, color: c.textSec }}>Requests you send appear here with our replies.</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {tickets.map((t, i) => (
              <Pressable
                key={t._id}
                onPress={() => navigation.navigate('SupportTicket', { ticketId: t._id })}
                accessibilityRole="button"
                style={[styles.qRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }} numberOfLines={1}>{t.subject}</Text>
                  <Text style={{ fontSize: 13, color: t.status === 'answered' ? c.primary : c.textSec }}>
                    {STATUS[t.status]} · {new Date(t.updatedAt).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short' })}
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
