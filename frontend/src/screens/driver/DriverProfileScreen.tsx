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
import { ratingService, type RatingSummary } from '../../services/ratingService';
import type { Rating, User, VerifiedStatus } from '../../types/api';
import { displayPhone } from '../../utils/phone';
import { VEHICLE_CATEGORIES, vehicleCategory } from '../../utils/vehicles';
import { REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type KycStatus = 'approved' | 'pending' | 'rejected' | 'none';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(REGION.dateLocale, { month: 'short', year: 'numeric' });
}

export function DriverProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { c, logout, switchRole } = useApp();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Rating[]>([]);
  const [badge, setBadge] = useState<VerifiedStatus | null>(null);
  const [summary, setSummary] = useState<RatingSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      userService
        .getMyProfile()
        .then(user => {
          if (active) setProfile(user);
          ratingService.getSummary(user._id, 'driver').then(s => { if (active) setSummary(s); }).catch(() => undefined);
          return ratingService.getUserRatings(user._id, 1, 5, 'driver');
        })
        .then(r => { if (active) setReviews(r); })
        .catch(() => undefined);
      userService.getVerifiedStatus().then(b => { if (active) setBadge(b); }).catch(() => undefined);
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
  const contact = displayPhone(profile?.phone) ?? profile?.email ?? '';
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(REGION.dateLocale, { month: 'short', year: 'numeric' })
    : null;

  const kyc: Record<KycStatus, { icon: IconName; label: string; fg: string; bg: string }> = {
    approved: { icon: 'check-decagram', label: t('driverProfile.kyc.approved'), fg: c.success, bg: c.successLight },
    pending: { icon: 'clock-outline', label: t('driverProfile.kyc.pending'), fg: c.warning, bg: c.warningLight },
    rejected: { icon: 'alert-circle-outline', label: t('driverProfile.kyc.rejected'), fg: c.error, bg: c.errorLight },
    none: { icon: 'card-account-details-outline', label: t('driverProfile.kyc.none'), fg: c.textSec, bg: c.surfaceVariant },
  };
  const kycInfo = kyc[kycStatus] ?? kyc.none;

  const menu: { icon: IconName; label: string; sub?: string; onPress: () => void }[] = [
    { icon: 'cash', label: t('driverProfile.menu.earnings'), onPress: () => navigation.navigate('Earnings') },
    {
      icon: 'car-clock',
      label: t('driverProfile.menu.rides'),
      sub: rides > 0 ? (rides === 1 ? t('driverProfile.menu.ridesOne') : t('driverProfile.menu.ridesMany', { count: rides })) : undefined,
      onPress: () => navigation.navigate('UpcomingRides'),
    },
    { icon: 'card-account-details-outline', label: t('driverProfile.menu.verification'), sub: kycInfo.label, onPress: () => navigation.navigate('KYC') },
    { icon: 'crosshairs-gps', label: t('driverProfile.menu.tracker'), sub: t('driverProfile.menu.trackerSub'), onPress: () => navigation.navigate('CarTracker') },
    { icon: 'shield-check-outline', label: t('driverProfile.menu.safety'), onPress: () => navigation.navigate('SOS') },
    { icon: 'account-heart-outline', label: t('driverProfile.menu.contacts'), sub: t('driverProfile.menu.contactsSub'), onPress: () => navigation.navigate('EmergencyContacts') },
    { icon: 'briefcase-outline', label: t('profile.menu.work'), sub: t('profile.menu.workSub'), onPress: () => navigation.navigate('Work') },
    { icon: 'card-account-details-star-outline', label: t('driverProfile.menu.identity'), sub: t('driverProfile.menu.identitySub'), onPress: () => navigation.navigate('IdentityCheck') },
    { icon: 'account-switch-outline', label: t('driverProfile.menu.switch'), onPress: switchRole },
    { icon: 'cog-outline', label: t('driverProfile.menu.settings'), onPress: () => navigation.navigate('Settings') },
  ];

  return (
    <View style={[s.root, { backgroundColor: c.surface, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: c.text }]} accessibilityRole="header">{t('driverProfile.profile')}</Text>

        {/* ── Account card ─────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }, Shadow.md]}>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${contact}. Edit profile`}
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
                {badge?.verified && <Icon name="check-decagram" size={18} color={c.success} label={t('driverProfile.verifiedDriver')} />}
              </View>
              <Text style={[s.phone, { color: c.textSec }]}>{contact}</Text>
              {memberSince && <Text style={[s.since, { color: c.textSec }]}>{t('driverProfile.since', { year: memberSince })}</Text>}
            </View>
            <Icon name="chevron-right" size={24} color={c.textSec} />
          </Pressable>
          <View style={[s.cardDivider, { backgroundColor: c.border }]} />
          <View style={s.cardRow}>
            <Icon name="star" size={24} color="#F5B301" />
            <Text style={[s.ratingText, { color: c.text }]}>
              {ratingCount > 0 ? t('driverProfile.rating', { rating: avgRating.toFixed(1) }) : t('driverProfile.noRatings')}
            </Text>
            {ratingCount > 0 && (
              <Text style={[s.ratingCount, { color: c.textSec }]}>
                {ratingCount === 1 ? t('common.riderOne') : t('common.riderMany', { count: ratingCount })}
              </Text>
            )}
          </View>
          {summary && Object.values(summary.categories).some(v => v !== null) ? (
            <Text style={[s.hint, { color: c.textSec, paddingBottom: Spacing.md }]}>
              {([['Behaviour', summary.categories.behavior], ['Cleanliness', summary.categories.cleanliness], ['Punctuality', summary.categories.punctuality]] as const)
                .filter(([, v]) => v !== null)
                .map(([label, v]) => `${label} ${v?.toFixed(1)}`)
                .join(' · ')}
            </Text>
          ) : null}
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
                  ? t('driverProfile.beingReviewed')
                  : kycStatus === 'rejected'
                    ? t('driverProfile.resubmitYourDocuments') : t('driverProfile.getVerifiedToOfferRides')}
              </Text>
              <Text style={[s.calloutSub, { color: c.textSec }]}>
                {kycStatus === 'rejected' && profile?.kyc?.rejectionReason
                  ? t('driverProfile.reason', { reason: profile.kyc.rejectionReason })
                  : t('driverProfile.onlyReviewed')}
              </Text>
            </View>
            {kycStatus !== 'pending' && <Icon name="chevron-right" size={22} color={c.textSec} />}
          </Pressable>
        )}

        {/* ── Verified Driver badge progress (UC-D10) ──────── */}
        {kycStatus === 'approved' && badge && (
          <>
            <Text style={[s.sectionTitle, { color: c.text }]}>{badge.verified ? t('driverProfile.verifiedDriver2') : t('driverProfile.earnTheVerifiedBadge')}</Text>
            <Text style={[s.hint, { color: c.textSec, marginBottom: Spacing.sm }]}>
              {badge.verified
                ? t('driverProfile.ridersSeeTheBadgeNext') : t('driverProfile.ridersSeeAVerifiedBadge')}
            </Text>
            {badge.checks.map(check => (
              <View key={check.label} style={s.badgeRow} accessible accessibilityLabel={`${check.label}: ${check.met ? 'met' : 'not yet'}, ${check.progress}`}>
                <Icon
                  name={check.met ? 'check-circle' : 'checkbox-blank-circle-outline'}
                  size={20}
                  color={check.met ? c.success : c.textSec}
                />
                <Text style={[s.flex1, { fontSize: Typography.md, color: c.text }]}>{check.label}</Text>
                <Text style={{ fontSize: Typography.sm, color: c.textSec }}>{check.progress}</Text>
              </View>
            ))}
          </>
        )}

        {/* ── Vehicles ─────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: c.text }]}>{t('driverProfile.vehicles')}</Text>
        {vehicles.length === 0 ? (
          <Text style={[s.hint, { color: c.textSec }]}>{t('driverProfile.yourVehicleIsAddedWhen')}</Text>
        ) : (
          vehicles.map((v, i) => (
            <View
              key={v._id}
              style={[s.listRow, i < vehicles.length - 1 && [s.dashed, { borderColor: c.border }]]}
            >
              <View style={[s.listIcon, { backgroundColor: c.surfaceVariant }]}>
                <Icon name={VEHICLE_CATEGORIES[vehicleCategory(v.vehicleType)].icon} size={22} color={c.primary} />
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
        <Text style={[s.sectionTitle, { color: c.text }]}>{t('driverProfile.recentReviews')}</Text>
        {reviews.length === 0 ? (
          <Text style={[s.hint, { color: c.textSec }]}>{t('driverProfile.reviewsFromYourRidersWill')}</Text>
        ) : (
          reviews.map((r, i) => (
            <View key={r._id} style={[s.review, i < reviews.length - 1 && [s.dashed, { borderColor: c.border }]]}>
              <View style={s.reviewHeader}>
                <Text style={[s.listTitle, s.flex1, { color: c.text }]} numberOfLines={1}>{r.rater?.name ?? t('common.rider')}</Text>
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
          <Text style={[s.logoutText, { color: c.error }]}>{t('driverProfile.logOut')}</Text>
        </Pressable>

        <Text style={[s.version, { color: c.textSec }]}>{t('driverProfile.version', { version: Constants.expoConfig?.version ?? '' })}</Text>
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
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 36 },
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
