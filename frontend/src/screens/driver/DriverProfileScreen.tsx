/**
 * screens/driver/DriverProfileScreen.tsx
 *
 * The driver's account, laid out like the rider profile: a card with their
 * name, verification and rating, their vehicles and latest reviews, then one
 * list for everything else (earnings, rides, safety, settings).
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { useApp } from '../../context/AppContext';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { Icon, type IconName } from '../../components/Icon';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { userService } from '../../services/userService';
import { ratingService } from '../../services/ratingService';
import type { Rating, User } from '../../types/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type KycStatus = 'approved' | 'pending' | 'rejected' | 'none';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', year: 'numeric' });
}

export function DriverProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { c, logout, switchRole } = useApp();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Rating[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      userService
        .getMyProfile()
        .then(user => {
          if (active) setProfile(user);
          return ratingService.getUserRatings(user._id, 1, 5, 'driver');
        })
        .then(r => { if (active) setReviews(r); })
        .catch(() => undefined);
      return () => { active = false; };
    }, []),
  );

  const vehicles = profile?.vehicles ?? [];
  const stats = profile?.stats;
  const ratingCount = stats?.totalRatingsAsDriver ?? 0;
  const avgRating = stats?.avgRatingAsDriver ?? 0;
  const rides = stats?.totalRidesAsDriver ?? 0;
  const kycStatus = (profile?.kyc?.status ?? 'none') as KycStatus;
  const name = profile?.name ?? '';
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })
    : null;

  const kyc: Record<KycStatus, { icon: IconName; label: string; fg: string; bg: string }> = {
    approved: { icon: 'check-decagram', label: 'Documents approved', fg: c.success, bg: c.successLight },
    pending: { icon: 'clock-outline', label: 'Documents under review', fg: c.warning, bg: c.warningLight },
    rejected: { icon: 'alert-circle-outline', label: 'Documents rejected', fg: c.error, bg: c.errorLight },
    none: { icon: 'card-account-details-outline', label: 'Documents not submitted', fg: c.textSec, bg: c.surfaceVariant },
  };
  const kycInfo = kyc[kycStatus] ?? kyc.none;

  const menu: { icon: IconName; label: string; sub?: string; onPress: () => void }[] = [
    { icon: 'cash', label: 'Earnings', onPress: () => navigation.navigate('Earnings') },
    {
      icon: 'car-clock',
      label: 'Your rides',
      sub: rides > 0 ? `${rides} ${rides === 1 ? 'ride' : 'rides'} driven` : undefined,
      onPress: () => navigation.navigate('UpcomingRides'),
    },
    { icon: 'card-account-details-outline', label: 'Driver verification', sub: kycInfo.label, onPress: () => navigation.navigate('KYC') },
    { icon: 'shield-check-outline', label: 'Safety', onPress: () => navigation.navigate('SOS') },
    { icon: 'account-heart-outline', label: 'Trusted contacts', sub: 'Alerted if you raise an SOS', onPress: () => navigation.navigate('EmergencyContacts') },
    { icon: 'account-switch-outline', label: 'Switch to riding', onPress: switchRole },
    { icon: 'cog-outline', label: 'Settings', onPress: () => navigation.navigate('Settings') },
  ];

  return (
    <View style={[s.root, { backgroundColor: c.surface, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: c.text }]} accessibilityRole="header">Profile</Text>

        {/* ── Account card ─────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }, Shadow.md]}>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${profile?.phone ?? ''}. Edit profile`}
            style={s.cardRow}
          >
            {profile?.profilePhotoUrl ? (
              <ImageWithFallback src={profile.profilePhotoUrl} alt={name} width={60} height={60} borderRadius={30} />
            ) : (
              <View style={[s.avatar, { backgroundColor: c.primaryLight }]}>
                {name ? (
                  <Text style={[s.avatarText, { color: c.primary }]}>{name.charAt(0).toUpperCase()}</Text>
                ) : (
                  <Icon name="account" size={30} color={c.primary} />
                )}
              </View>
            )}
            <View style={s.flex1}>
              <View style={s.nameRow}>
                <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{name || ' '}</Text>
                {kycStatus === 'approved' && <Icon name="check-decagram" size={18} color={c.success} label="Verified driver" />}
              </View>
              <Text style={[s.phone, { color: c.textSec }]}>{profile?.phone ?? ''}</Text>
              {memberSince && <Text style={[s.since, { color: c.textSec }]}>Driving since {memberSince}</Text>}
            </View>
            <Icon name="chevron-right" size={24} color={c.textSec} />
          </Pressable>
          <View style={[s.cardDivider, { backgroundColor: c.border }]} />
          <View style={s.cardRow}>
            <Icon name="star" size={24} color="#F5B301" />
            <Text style={[s.ratingText, { color: c.text }]}>
              {ratingCount > 0 ? `${avgRating.toFixed(1)} rating` : 'No ratings yet'}
            </Text>
            {ratingCount > 0 && (
              <Text style={[s.ratingCount, { color: c.textSec }]}>
                {ratingCount} {ratingCount === 1 ? 'rider' : 'riders'}
              </Text>
            )}
          </View>
        </View>

        {/* ── Verification callout ─────────────────────────── */}
        {kycStatus !== 'approved' && (
          <Pressable
            onPress={() => navigation.navigate('KYC')}
            disabled={kycStatus === 'pending'}
            accessibilityRole="button"
            style={[s.callout, { backgroundColor: kycInfo.bg }]}
          >
            <Icon name={kycInfo.icon} size={24} color={kycInfo.fg} />
            <View style={s.flex1}>
              <Text style={[s.calloutTitle, { color: c.text }]}>
                {kycStatus === 'pending'
                  ? 'Your documents are being reviewed'
                  : kycStatus === 'rejected'
                    ? 'Resubmit your documents'
                    : 'Get verified to offer rides'}
              </Text>
              <Text style={[s.calloutSub, { color: c.textSec }]}>
                {kycStatus === 'rejected' && profile?.kyc?.rejectionReason
                  ? `Reason: ${profile.kyc.rejectionReason}`
                  : 'Riders can only book drivers whose licence and vehicle documents have been reviewed.'}
              </Text>
            </View>
            {kycStatus !== 'pending' && <Icon name="chevron-right" size={22} color={c.textSec} />}
          </Pressable>
        )}

        {/* ── Vehicles ─────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: c.text }]}>Vehicles</Text>
        {vehicles.length === 0 ? (
          <Text style={[s.hint, { color: c.textSec }]}>Your vehicle is added when you submit driver verification.</Text>
        ) : (
          vehicles.map((v, i) => (
            <View
              key={v._id}
              style={[s.listRow, i < vehicles.length - 1 && [s.dashed, { borderColor: c.border }]]}
            >
              <View style={[s.listIcon, { backgroundColor: c.surfaceVariant }]}>
                <Icon name={v.vehicleType === 'bike' ? 'motorbike' : 'car-side'} size={22} color={c.primary} />
              </View>
              <View style={s.flex1}>
                <Text style={[s.listTitle, { color: c.text }]} numberOfLines={1}>{v.make} {v.model}</Text>
                <Text style={[s.listSub, { color: c.textSec }]} numberOfLines={1}>
                  {[v.color, v.plateNumber, v.year, v.hasAC ? 'AC' : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* ── Recent reviews ───────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: c.text }]}>Recent reviews</Text>
        {reviews.length === 0 ? (
          <Text style={[s.hint, { color: c.textSec }]}>Reviews from your riders will appear here.</Text>
        ) : (
          reviews.map((r, i) => (
            <View key={r._id} style={[s.review, i < reviews.length - 1 && [s.dashed, { borderColor: c.border }]]}>
              <View style={s.reviewHeader}>
                <Text style={[s.listTitle, s.flex1, { color: c.text }]} numberOfLines={1}>{r.rater?.name ?? 'Rider'}</Text>
                <View style={s.stars} accessible accessibilityLabel={`${r.score} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Icon key={j} name={j < r.score ? 'star' : 'star-outline'} size={14} color="#F5B301" />
                  ))}
                </View>
              </View>
              {r.comment ? <Text style={[s.reviewText, { color: c.text }]}>{r.comment}</Text> : null}
              <Text style={[s.listSub, { color: c.textSec }]}>{timeAgo(r.createdAt)}</Text>
            </View>
          ))
        )}

        {/* ── Menu ─────────────────────────────────────────── */}
        <View style={s.menu}>
          {menu.map(item => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [s.menuRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Icon name={item.icon} size={24} color={c.text} />
              <View style={s.flex1}>
                <Text style={[s.menuLabel, { color: c.text }]}>{item.label}</Text>
                {item.sub ? <Text style={[s.menuSub, { color: c.textSec }]}>{item.sub}</Text> : null}
              </View>
              <Icon name="chevron-right" size={24} color={c.textSec} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => logout()} accessibilityRole="button" style={[s.logout, { borderColor: c.border }]}>
          <Icon name="logout" size={22} color={c.error} />
          <Text style={[s.logoutText, { color: c.error }]}>Log out</Text>
        </Pressable>

        <Text style={[s.version, { color: c.textSec }]}>Poolora version {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  title: { fontSize: Typography['6xl'], fontWeight: Typography.extrabold, marginTop: Spacing.lg, marginBottom: Spacing.xl },

  card: { borderRadius: Radius['2xl'], borderWidth: 1, paddingHorizontal: Spacing.lg },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg },
  cardDivider: { height: 1 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: Typography.bold },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: Typography['3xl'], fontWeight: Typography.bold },
  phone: { fontSize: Typography.lg, marginTop: 2 },
  since: { fontSize: Typography.base, marginTop: 2 },
  ratingText: { flex: 1, fontSize: Typography.xl, fontWeight: Typography.semibold },
  ratingCount: { fontSize: Typography.md },

  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
  },
  calloutTitle: { fontSize: Typography.xl, fontWeight: Typography.bold },
  calloutSub: { fontSize: Typography.md, lineHeight: 20, marginTop: 2 },

  sectionTitle: { fontSize: Typography['3xl'], fontWeight: Typography.bold, marginTop: Spacing['2xl'], marginBottom: Spacing.sm },
  hint: { fontSize: Typography.md, lineHeight: 20 },
  dashed: { borderBottomWidth: 1, borderStyle: 'dashed' },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, minHeight: 68, paddingVertical: Spacing.md },
  listIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: Typography['2xl'], fontWeight: Typography.semibold },
  listSub: { fontSize: Typography.md, marginTop: 2 },

  review: { paddingVertical: Spacing.md },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stars: { flexDirection: 'row', gap: 1 },
  reviewText: { fontSize: Typography.lg, lineHeight: 21, marginTop: 4 },

  menu: { marginTop: Spacing.xl },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, minHeight: 64, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  menuLabel: { fontSize: Typography['2xl'], fontWeight: Typography.medium },
  menuSub: { fontSize: Typography.md, marginTop: 2 },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    marginTop: Spacing['2xl'],
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  logoutText: { fontSize: Typography.xl, fontWeight: Typography.bold },
  version: { fontSize: Typography.sm, textAlign: 'center', marginTop: Spacing.lg },
});
