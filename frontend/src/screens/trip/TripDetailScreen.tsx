import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TripTab = 'itinerary' | 'expenses' | 'voting' | 'chat';

const MEMBERS = ['Meera P.', 'Arjun V.', 'Sanya S.', 'You'];
const MEMBER_OPACITY = [0.9, 0.7, 0.5, 0.3];

const TABS: { id: TripTab; label: string; icon: string }[] = [
  { id: 'itinerary', label: 'Itinerary', icon: '📅' },
  { id: 'expenses', label: 'Expenses', icon: '💰' },
  { id: 'voting', label: 'Voting', icon: '🗳️' },
  { id: 'chat', label: 'Chat', icon: '💬' },
];

const EXPENSES = [
  { id: '1', label: 'Hotel Booking (3 nights)', total: 9000, paidBy: 'Meera P.', split: 2250, settled: true },
  { id: '2', label: 'Car Rental', total: 3000, paidBy: 'Arjun V.', split: 750, settled: false },
  { id: '3', label: 'Lunch - Day 1', total: 1200, paidBy: 'You', split: 300, settled: false },
];

const ACTIVITIES = [
  { id: '1', label: 'Baga Beach Sunset Walk', votes: 3, total: 4 },
  { id: '2', label: 'Fort Aguada Visit', votes: 2, total: 4 },
  { id: '3', label: 'Spice Plantation Tour', votes: 1, total: 4 },
];

const ITINERARY = [
  {
    day: 'Day 1 · March 1',
    items: [
      ['Morning', 'Fly Bengaluru → Goa (IndiGo 6E-845)'],
      ['Afternoon', 'Check-in to Villa, Explore Candolim'],
      ['Evening', 'Sunset at Calangute Beach'],
    ],
  },
  {
    day: 'Day 2 · March 2',
    items: [
      ['Morning', 'Visit Fort Aguada'],
      ['Afternoon', 'Lunch & Baga Beach'],
      ['Evening', 'Titos Club Night Out'],
    ],
  },
  {
    day: 'Day 3 · March 3',
    items: [
      ['Morning', 'Breakfast at Shacks'],
      ['Afternoon', 'Souvenir Shopping'],
      ['Evening', 'Fly back to Bengaluru'],
    ],
  },
];

const SETTLEMENTS = [
  { from: 'You', to: 'Arjun V.', amt: 750 },
  { from: 'Sanya S.', to: 'Meera P.', amt: 2250 },
];

export function TripDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TripTab>('itinerary');
  const [votedActivities, setVotedActivities] = useState<string[]>(['1']);

  const toggleVote = (id: string) =>
    setVotedActivities(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  /* ── Tab content renderers ─────────────────────────────── */
  const renderItinerary = () =>
    ITINERARY.map(day => (
      <View key={day.day} style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[s.dayHeader, { backgroundColor: c.successLight }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.success }}>{day.day}</Text>
        </View>
        <View style={s.dayBody}>
          {day.items.map(([time, activity]) => (
            <View key={time} style={s.itineraryRow}>
              <Text style={[s.itTime, { color: c.textSec }]}>{time}</Text>
              <Text style={{ fontSize: 13, color: c.text, flex: 1 }}>{activity}</Text>
            </View>
          ))}
        </View>
      </View>
    ));

  const renderExpenses = () => (
    <>
      {/* Total card */}
      <LinearGradient
        colors={[c.success, '#00952A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.totalCard}
      >
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>TOTAL TRIP EXPENSES</Text>
        <Text style={{ fontSize: 32, fontWeight: '800', color: 'white' }}>₹13,200</Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Your share: ₹3,300 · 2 pending</Text>
      </LinearGradient>

      {/* Expense rows */}
      {EXPENSES.map(exp => (
        <View key={exp.id} style={[s.expCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={s.expTop}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{exp.label}</Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>Paid by {exp.paidBy}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>₹{exp.total}</Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>Your share: ₹{exp.split}</Text>
            </View>
          </View>
          {exp.settled ? (
            <View style={[s.settledBadge, { backgroundColor: c.successLight }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.success }}>✓ Settled</Text>
            </View>
          ) : (
            <Pressable style={[s.payBtn, { backgroundColor: c.primary }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>Pay ₹{exp.split} via UPI</Text>
            </Pressable>
          )}
        </View>
      ))}

      {/* Who owes whom */}
      <View style={[s.expCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 }}>Who Owes Whom</Text>
        {SETTLEMENTS.map((s2, i) => (
          <View key={i} style={s.settlementRow}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{s2.from}</Text>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill={c.textSec} />
            </Svg>
            <Text style={{ fontSize: 13, color: c.textSec }}>{s2.to}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.error, marginLeft: 'auto' }}>₹{s2.amt}</Text>
          </View>
        ))}
      </View>
    </>
  );

  const renderVoting = () => (
    <>
      <Text style={{ fontSize: 14, color: c.textSec }}>Vote on activities for the trip</Text>
      {ACTIVITIES.map(activity => {
        const hasVoted = votedActivities.includes(activity.id);
        return (
          <View
            key={activity.id}
            style={[s.voteCard, { borderColor: hasVoted ? c.success : c.border, backgroundColor: c.surface }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{activity.label}</Text>
              <Text style={{ fontSize: 13, color: c.textSec, marginTop: 4 }}>
                {activity.votes}/{activity.total} votes
              </Text>
              <View style={[s.voteTrack, { backgroundColor: c.bg }]}>
                <View
                  style={[
                    s.voteFill,
                    {
                      width: `${(activity.votes / activity.total) * 100}%` as any,
                      backgroundColor: hasVoted ? c.success : c.primary,
                    },
                  ]}
                />
              </View>
            </View>
            <Pressable
              onPress={() => toggleVote(activity.id)}
              style={[
                s.voteBtn,
                {
                  backgroundColor: hasVoted ? c.successLight : c.bg,
                  borderColor: hasVoted ? c.success : c.border,
                },
              ]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24">
                {hasVoted ? (
                  <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill={c.success} />
                ) : (
                  <Path
                    d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"
                    fill={c.textSec}
                  />
                )}
              </Svg>
            </Pressable>
          </View>
        );
      })}
      <Pressable style={[s.dashedBtn, { borderColor: c.border }]}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill={c.textSec} />
        </Svg>
        <Text style={{ fontSize: 14, color: c.textSec }}>Suggest Activity</Text>
      </Pressable>
    </>
  );

  const renderChat = () => (
    <View style={s.chatEmpty}>
      <Text style={{ fontSize: 48 }}>💬</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Group Chat</Text>
      <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center' }}>
        Chat with your travel group to coordinate plans
      </Text>
      <Pressable style={[s.chatBtn, { backgroundColor: c.success }]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>Open Group Chat</Text>
      </Pressable>
    </View>
  );

  const TAB_CONTENT: Record<TripTab, () => React.ReactNode> = {
    itinerary: renderItinerary,
    expenses: renderExpenses,
    voting: renderVoting,
    chat: renderChat,
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <LinearGradient colors={['#00C853', '#00952A']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.header}>
        <View style={s.headerRow}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>Goa Weekend Getaway</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>1 Mar – 3 Mar · 4 travelers</Text>
          </View>
        </View>
        {/* Avatars */}
        <View style={s.avatarRow}>
          {MEMBERS.map((member, i) => (
            <View key={member} style={s.avatarCol}>
              <View
                style={[
                  s.avatarCircle,
                  { backgroundColor: `rgba(255,255,255,${MEMBER_OPACITY[i]})` },
                ]}
              >
                <Text style={{ fontSize: 14 }}>👤</Text>
              </View>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{member.split(' ')[0]}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <View style={[s.tabBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={s.tabItem}>
              <Text style={{ fontSize: 16 }}>{tab.icon}</Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: active ? '700' : '500',
                  color: active ? c.success : c.textSec,
                }}
              >
                {tab.label}
              </Text>
              {active && <View style={[s.tabIndicator, { backgroundColor: c.success }]} />}
            </Pressable>
          );
        })}
      </View>

      {/* ── Content ─────────────────────────────────────────── */}
      <ScrollView style={s.flex1} contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
        {TAB_CONTENT[activeTab]()}
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatarRow: { flexDirection: 'row', gap: 12 },
  avatarCol: { alignItems: 'center', gap: 4 },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  /* Tabs */
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 2, position: 'relative' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 },

  /* Scroll */
  scrollBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 12 },

  /* Itinerary */
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  dayHeader: { paddingVertical: 12, paddingHorizontal: 16 },
  dayBody: { padding: 16, gap: 8 },
  itineraryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itTime: { fontSize: 11, fontWeight: '600', minWidth: 55 },

  /* Expenses */
  totalCard: { borderRadius: 16, padding: 16 },
  expCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  expTop: { flexDirection: 'row', marginBottom: 8 },
  settledBadge: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },
  payBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  settlementRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },

  /* Voting */
  voteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1.5, padding: 16 },
  voteTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  voteFill: { height: '100%', borderRadius: 3 },
  voteBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dashedBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  /* Chat */
  chatEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  chatBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 },
});
