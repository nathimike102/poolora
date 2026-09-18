import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import type { RootStackParamList } from '../../navigation/types';
import { userService } from '../../services/userService';
import { ratingService } from '../../services/ratingService';
import type { Rating, User } from '../../types/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STAR_PATH = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

const KYC_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  approved: { bg: '#E8F5E9', text: '#1B7F3B', label: 'Approved' },
  pending: { bg: '#FFF8E1', text: '#8A5A00', label: 'Under review' },
  rejected: { bg: '#FFEBEE', text: '#B42318', label: 'Rejected' },
  none: { bg: '#F6F8FC', text: '#4B5563', label: 'Not submitted' },
};

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', year: 'numeric' });
}

export function DriverProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Rating[]>([]);

  useFocusEffect(
    useCallback(() => {
      userService
        .getMyProfile()
        .then(user => {
          setProfile(user);
          return ratingService.getUserRatings(user._id, 1, 5);
        })
        .then(setReviews)
        .catch(() => undefined);
    }, []),
  );

  const vehicles = profile?.vehicles ?? [];
  const stats = profile?.stats;
  const ratingCount = stats?.totalRatingsAsDriver ?? 0;
  const avgRating = stats?.avgRatingAsDriver ?? 0;
  const kycStatus = profile?.kyc?.status ?? 'none';
  const kycBadge = KYC_BADGE[kycStatus] ?? KYC_BADGE.none;
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })
    : null;

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView style={s.flex1} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
        {/* ── Gradient header ──────────────────────────────── */}
        <LinearGradient
          colors={['#1A2E4A', c.primary]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={s.header}
        >
          {/* Top row */}
          <View style={s.topRow}>
            <BackButton onPress={() => navigation.goBack()} />
            <Text style={s.headerTitle}>Driver Profile</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} style={s.gearBtn}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path
                  d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
                  fill="white"
                />
              </Svg>
            </Pressable>
          </View>

          {/* Profile info */}
          <View style={s.profileRow}>
            {profile?.profilePhotoUrl ? (
              <ImageWithFallback
                src={profile.profilePhotoUrl}
                alt={profile.name}
                width={72}
                height={72}
                borderRadius={20}
                style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' }}
              />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitial}>{profile?.name?.charAt(0).toUpperCase() ?? ''}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={s.nameRow}>
                <Text style={s.driverName}>{profile?.name ?? ' '}</Text>
                {kycStatus === 'approved' && (
                  <View style={[s.verifiedBadge, { backgroundColor: c.success }]}>
                    <Text style={s.verifiedText}>KYC approved</Text>
                  </View>
                )}
              </View>
              {memberSince && <Text style={s.sinceText}>Member since {memberSince}</Text>}
              <View style={s.starsRow}>
                {ratingCount > 0 ? (
                  <>
                    <Svg width={14} height={14} viewBox="0 0 24 24">
                      <Path d={STAR_PATH} fill="#FFB300" />
                    </Svg>
                    <Text style={s.ratingText}>
                      {avgRating.toFixed(1)} from {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
                    </Text>
                  </>
                ) : (
                  <Text style={[s.ratingText, { marginLeft: 0 }]}>No ratings yet</Text>
                )}
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Vehicles ─────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.secHeader}>
            <Text style={[s.secTitle, { color: c.text }]}>Vehicles</Text>
          </View>
          {vehicles.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center' }}>
                Your vehicle is added when you submit driver verification.
              </Text>
            </View>
          ) : (
            vehicles.map((vehicle, idx) => (
              <View
                key={vehicle._id}
                style={[s.vehicleCard, { backgroundColor: c.surface, borderColor: c.border, marginBottom: idx < vehicles.length - 1 ? 14 : 0 }]}
              >
                <View style={s.vehicleBody}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>
                    {vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={{ fontSize: 13, color: c.textSec }}>
                    {vehicle.color} · {vehicle.plateNumber} · {vehicle.year}
                  </Text>
                  <View style={s.featureRow}>
                    <View style={[s.featureChip, { backgroundColor: c.bg, borderColor: c.border }]}>
                      <Text style={{ fontSize: 12, color: c.textSec, textTransform: 'capitalize' }}>{vehicle.vehicleType}</Text>
                    </View>
                    {vehicle.hasAC && (
                      <View style={[s.featureChip, { backgroundColor: c.bg, borderColor: c.border }]}>
                        <Text style={{ fontSize: 12, color: c.textSec }}>AC</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Verification ─────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.secHeader}>
            <Text style={[s.secTitle, { color: c.text }]}>Driver verification</Text>
          </View>

          <View style={[s.docsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={s.docRow}>
              <Text style={{ flex: 1, fontSize: 14, color: c.text }}>Driving licence and vehicle documents</Text>
              <View style={[s.docStatusBadge, { backgroundColor: kycBadge.bg }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: kycBadge.text }}>{kycBadge.label}</Text>
              </View>
            </View>
            {kycStatus === 'rejected' && profile?.kyc?.rejectionReason && (
              <Text style={{ fontSize: 13, color: c.textSec, paddingHorizontal: 16, paddingBottom: 16 }}>
                Reason: {profile.kyc.rejectionReason}
              </Text>
            )}
          </View>
        </View>

        {/* ── Recent Reviews ───────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.secTitle, { color: c.text, marginBottom: 12 }]}>Recent reviews</Text>
          {reviews.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center' }}>
                Reviews from your riders will appear here.
              </Text>
            </View>
          ) : (
            reviews.map(r => (
              <View key={r._id} style={[s.reviewCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={s.reviewHeader}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{r.rater?.name ?? 'Rider'}</Text>
                  <View style={s.starsRowSmall} accessibilityLabel={`${r.score} out of 5 stars`}>
                    {Array.from({ length: r.score }).map((_, j) => (
                      <Svg key={j} width={12} height={12} viewBox="0 0 24 24">
                        <Path d={STAR_PATH} fill="#FFB300" />
                      </Svg>
                    ))}
                  </View>
                </View>
                {r.comment ? <Text style={{ fontSize: 13, color: c.textSec }}>{r.comment}</Text> : null}
                <Text style={{ fontSize: 11, color: c.textSec, marginTop: 6 }}>{timeAgo(r.createdAt)}</Text>
              </View>
            ))
          )}
        </View>

        {kycStatus !== 'approved' && kycStatus !== 'pending' && (
          <View style={s.section}>
            <View style={[s.verifiedCard, { backgroundColor: c.primaryLight }]}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>
                {kycStatus === 'rejected' ? 'Resubmit your documents' : 'Get verified to offer rides'}
              </Text>
              <Text style={{ fontSize: 13, color: c.textSec, marginTop: 4, lineHeight: 20 }}>
                Riders can only book drivers whose licence and vehicle documents have been reviewed.
              </Text>
              <Pressable
                onPress={() => navigation.navigate('KYC')}
                accessibilityRole="button"
                style={[s.applyBtn, { backgroundColor: c.primary }]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: c.textOnPrimary }}>Start verification</Text>
              </Pressable>
            </View>
          </View>
        )}
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
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: 'white', marginLeft: 12 },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Profile */
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  driverName: { fontSize: 20, fontWeight: '800', color: 'white' },
  verifiedBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
  verifiedText: { fontSize: 10, fontWeight: '700', color: 'white' },
  sinceText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: 'white', marginLeft: 4 },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 28, fontWeight: '700', color: 'white' },

  /* Section */
  section: { paddingHorizontal: 20, paddingTop: 16 },
  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  secTitle: { fontSize: 16, fontWeight: '700' },
  addBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },

  /* Vehicle */
  vehicleCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  vehicleBody: { padding: 16 },
  vehicleTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  activeBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  featureRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  featureChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1 },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: 'center' },
  vehicleImagePlaceholder: { width: '100%', height: 140, borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: 'center', justifyContent: 'center' },

  /* Docs */
  docsCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1, marginLeft: 16 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  docStatusBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8 },

  /* Reviews */
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  starsRowSmall: { flexDirection: 'row', gap: 2 },

  /* Verified program */
  verifiedCard: { borderRadius: 16, padding: 16 },
  applyBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
});
