import React from 'react';
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
import { ImageWithFallback } from '../../components/ImageWithFallback';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PARTNERS = [
  {
    id: '1',
    name: 'Meera Patel',
    avatar: 'https://images.unsplash.com/photo-1580746453801-37b0bc56f3b4?w=60&h=60&fit=crop',
    from: 'Bengaluru',
    interests: ['🏖️ Beach', '📸 Photography', '🍜 Food'],
    compatibility: 94,
    trips: 12,
    bio: 'Travel enthusiast! Love exploring new places and cuisines.',
  },
  {
    id: '2',
    name: 'Arjun Verma',
    avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?w=60&h=60&fit=crop',
    from: 'Bengaluru',
    interests: ['🏖️ Beach', '🌿 Nature', '🎵 Music'],
    compatibility: 87,
    trips: 8,
    bio: 'Weekend traveler. Always up for an adventure!',
  },
  {
    id: '3',
    name: 'Sanya Singh',
    avatar: 'https://images.unsplash.com/photo-1580746453801-37b0bc56f3b4?w=60&h=60&fit=crop',
    from: 'Mysuru',
    interests: ['🏛️ Heritage', '📸 Photography', '🧘 Wellness'],
    compatibility: 76,
    trips: 21,
    bio: 'History buff and amateur photographer. Love quiet getaways.',
  },
];

export function TripPartnersScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <LinearGradient colors={['#00C853', '#00952A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        <View style={s.headerRow}>
          <BackButton onPress={() => navigation.goBack()} />
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>Travel Partners</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Goa Weekend · 3 compatible matches</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Partner cards ───────────────────────────────────── */}
      <ScrollView style={s.flex1} contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
        {PARTNERS.map(p => {
          const high = p.compatibility >= 90;
          return (
            <Pressable
              key={p.id}
              onPress={() => navigation.navigate('TripDetail' as any)}
              style={[s.card, { backgroundColor: c.surface, borderColor: c.border, ...Shadow }]}
            >
              {/* Top row: avatar + info + compatibility badge */}
              <View style={s.topRow}>
                <ImageWithFallback
                  src={p.avatar}
                  alt={p.name}
                  width={52}
                  height={52}
                  borderRadius={14}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{p.name}</Text>
                  <Text style={{ fontSize: 12, color: c.textSec }}>From {p.from} · {p.trips} trips</Text>
                  <Text style={{ fontSize: 13, color: c.textSec, marginTop: 4, lineHeight: 17 }}>{p.bio}</Text>
                </View>
                <View
                  style={[
                    s.matchBadge,
                    { backgroundColor: high ? c.successLight : c.primaryLight },
                  ]}
                >
                  <Text style={{ fontSize: 16, fontWeight: '800', color: high ? c.success : c.primary }}>
                    {p.compatibility}%
                  </Text>
                  <Text style={{ fontSize: 9, color: high ? c.success : c.primary }}>match</Text>
                </View>
              </View>

              {/* Interest chips */}
              <View style={s.chipRow}>
                {p.interests.map(int => (
                  <View key={int} style={[s.chip, { backgroundColor: c.bg, borderColor: c.border }]}>
                    <Text style={{ fontSize: 12, color: c.textSec }}>{int}</Text>
                  </View>
                ))}
              </View>

              {/* Action buttons */}
              <View style={s.actionRow}>
                <Pressable style={[s.msgBtn, { backgroundColor: c.primaryLight }]}>
                  <Svg width={15} height={15} viewBox="0 0 24 24">
                    <Path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill={c.primary} />
                  </Svg>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Message</Text>
                </Pressable>
                <Pressable style={s.connectBtnWrap}>
                  <LinearGradient
                    colors={['#00C853', '#00952A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.connectBtn}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>Connect</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  /* Scroll */
  scrollBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 12 },

  /* Card */
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  matchBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* Chips */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },

  /* Actions */
  actionRow: { flexDirection: 'row', gap: 8 },
  msgBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  connectBtnWrap: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  connectBtn: { height: 40, alignItems: 'center', justifyContent: 'center' },
});
