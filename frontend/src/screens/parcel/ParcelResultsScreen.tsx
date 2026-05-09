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

const DRIVERS = [
  {
    id: '1',
    name: 'Rajesh Kumar',
    avatar: 'https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=60&h=60&fit=crop',
    rating: 4.9,
    parcels: 234,
    from: 'Koramangala',
    to: 'Whitefield',
    departure: '9:00 AM',
    price: 85,
    trustScore: 98,
    verified: true,
  },
  {
    id: '2',
    name: 'Anita Sharma',
    avatar: 'https://images.unsplash.com/photo-1580746453801-37b0bc56f3b4?w=60&h=60&fit=crop',
    rating: 4.7,
    parcels: 156,
    from: 'BTM Layout',
    to: 'Whitefield',
    departure: '9:30 AM',
    price: 75,
    trustScore: 91,
    verified: true,
  },
];

export function ParcelResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────── */}
      <LinearGradient
        colors={['#FF8A50', '#FF6B35']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ marginLeft: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>Parcel Drivers</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
            Koramangala → Whitefield · Today
          </Text>
        </View>
      </LinearGradient>

      {/* ── Content ────────────────────────────────────────── */}
      <ScrollView style={s.flex1} contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 14, color: c.textSec, marginBottom: 12 }}>
          <Text style={{ fontWeight: '700', color: c.text }}>2 drivers</Text> heading your way
        </Text>

        {DRIVERS.map(d => (
          <Pressable
            key={d.id}
            onPress={() => navigation.navigate('ParcelTracking', { parcelId: d.id })}
          >
            <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }, Shadow.sm]}>
              {/* Top row: avatar + info + trust */}
              <View style={s.topRow}>
                <ImageWithFallback
                  src={d.avatar}
                  alt={d.name}
                  width={52}
                  height={52}
                  borderRadius={14}
                />
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{d.name}</Text>
                    {d.verified && (
                      <View style={[s.verifiedDot, { backgroundColor: c.primary }]}>
                        <Svg width={8} height={8} viewBox="0 0 24 24">
                          <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="white" />
                        </Svg>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: c.textSec }}>
                    {d.parcels} deliveries · ⭐ {d.rating}
                  </Text>
                </View>
                <View
                  style={[
                    s.trustBadge,
                    {
                      backgroundColor: d.trustScore >= 95 ? c.successLight : c.primaryLight,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: d.trustScore >= 95 ? c.success : c.primary,
                    }}
                  >
                    Trust {d.trustScore}%
                  </Text>
                </View>
              </View>

              {/* Route row */}
              <View style={[s.routeRow, { backgroundColor: c.bg }]}>
                <View style={[s.dotSm, { backgroundColor: c.primary }]} />
                <Text style={{ fontSize: 13, color: c.text }}>{d.from}</Text>
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill={c.textSec} />
                </Svg>
                <View style={[s.squareSm, { backgroundColor: c.error }]} />
                <Text style={{ fontSize: 13, color: c.text }}>{d.to}</Text>
                <Text style={{ marginLeft: 'auto', fontSize: 12, color: c.textSec }}>{d.departure}</Text>
              </View>

              {/* Bottom: price + book */}
              <View style={s.bottomRow}>
                <View style={s.priceBadge}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#FF8A50' }}>₹{d.price}</Text>
                </View>
                <Pressable onPress={() => navigation.navigate('ParcelTracking', { parcelId: d.id })}>
                  <LinearGradient
                    colors={['#FF8A50', '#FF6B35']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.bookBtn}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>Book Now</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },

  scrollBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  /* Card */
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },

  /* Top row */
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },

  /* Route */
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  dotSm: { width: 6, height: 6, borderRadius: 3 },
  squareSm: { width: 6, height: 6, borderRadius: 1 },

  /* Bottom */
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFF3EE',
  },
  bookBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10 },
});
