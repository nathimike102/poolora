/**
 * screens/shared/ProfileScreen.tsx
 *
 * The account, for riders and drivers alike, in Uber's layout: the name large
 * with the picture in a ring that fills as the profile is completed, quick
 * tiles, then everything else as cards with a 3D picture. Drivers also see
 * their verification, badge progress, vehicles and latest reviews.
 */

import React, { useCallback, useState } from 'react';
import { Linking, View, StyleSheet, ScrollView, Pressable, Modal, Alert } from 'react-native';
import { Text } from '../../components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { userService } from '../../services/userService';
import { ratingService, type RatingSummary } from '../../services/ratingService';
import type { Rating, User, VerifiedStatus } from '../../types/api';
import { useApp } from '../../context/AppContext';
import type { RootStackParamList } from '../../navigation/types';
import { Icon3D, type Icon3DName } from '../../components/Icon3D';
import { Icon, type IconName } from '../../components/Icon';
import { AvatarRing } from '../../components/AvatarRing';
import { ScreenGlow } from '../../components/ScreenGlow';
import { COMPANY } from '../../config/company';
import { REGION, formatPhone } from '../../utils/region';
import { Typography, Spacing, Radius } from '../../theme';
import { displayPhone, realPhone } from '../../utils/phone';
import { formatKg } from '../../utils/carbon';
import { askPhotoSource, pickProfilePhoto } from '../../utils/profilePhoto';
import { errorHandler } from '../../utils/errorHandler';
import { VEHICLE_CATEGORIES, vehicleCategory } from '../../utils/vehicles';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

import { tc, tk } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type KycStatus = 'approved' | 'pending' | 'rejected' | 'none';

const HELP_ITEMS: { icon: IconName; title: string; sub: string; url: string }[] = [
  // Words are read from the catalogue when shown, so they follow the language
  // Only a local support line; none is listed until the market has one (utils/region)
  ...(REGION.supportPhone
    ? [{ icon: 'phone-outline' as IconName, get title() { return i18n.t('profile.help.call'); }, get sub() { return i18n.t('profile.help.callSub', { phone: formatPhone(REGION.supportPhone!) }); }, url: `tel:${REGION.supportPhone}` }]
    : []),
  { icon: 'email-outline', get title() { return i18n.t('profile.help.email'); }, sub: COMPANY.supportEmail, url: `mailto:${COMPANY.supportEmail}` },
  { icon: 'shield-lock-outline', get title() { return i18n.t('profile.help.privacy'); }, get sub() { return i18n.t('profile.help.privacySub'); }, url: COMPANY.privacyUrl },
  { icon: 'file-document-outline', get title() { return i18n.t('profile.help.terms'); }, get sub() { return i18n.t('profile.help.termsSub'); }, url: COMPANY.termsUrl },
];

/** Share of the profile that's filled in, for the ring around the picture. */
export function completion(p: User | null): number {
  if (!p) return 0;
  const fields = [p.name, realPhone(p.phone), p.email, p.profilePhotoUrl, p.gender, (p.emergencyContacts?.length ?? 0) > 0];
  return fields.filter(Boolean).length / fields.length;
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(REGION.dateLocale, { month: 'short', year: 'numeric' });
}

interface Card {
  icon: Icon3DName;
  label: string;
  sub?: string;
  onPress: () => void;
}

export function ProfileScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const {
    role,
    logout,
    switchRole
  } = useApp();
  const insets = useSafeAreaInsets();
  const [showHelp, setShowHelp] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  // Driver only
  const [reviews, setReviews] = useState<Rating[]>([]);
  const [badge, setBadge] = useState<VerifiedStatus | null>(null);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const isDriver = role === 'driver';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      userService
        .getMyProfile()
        .then(p => {
          if (!active) return;
          setProfile(p);
          if (!isDriver) return;
          ratingService.getSummary(p._id, 'driver').then(s => { if (active) setSummary(s); }).catch(() => undefined);
          ratingService.getUserRatings(p._id, 1, 5, 'driver').then(r => { if (active) setReviews(r); }).catch(() => undefined);
        })
        .catch(() => {});
      if (isDriver) userService.getVerifiedStatus().then(b => { if (active) setBadge(b); }).catch(() => undefined);
      return () => { active = false; };
    }, [isDriver]),
  );

  const changePhoto = () => {
    const upload = async (source: 'camera' | 'library') => {
      const picked = await pickProfilePhoto(source);
      if (!picked) return;
      setSavingPhoto(true);
      try {
        const url = await userService.setPhoto(picked.base64);
        setProfile(p => (p ? { ...p, profilePhotoUrl: url } : p));
      } catch (error) {
        Alert.alert(t('profile.photoFailed'), errorHandler.process(error).message);
      } finally {
        setSavingPhoto(false);
      }
    };
    const remove = async () => {
      try {
        await userService.removePhoto();
        setProfile(p => (p ? { ...p, profilePhotoUrl: undefined } : p));
      } catch (error) {
        Alert.alert(t('profile.photoFailed'), errorHandler.process(error).message);
      }
    };
    askPhotoSource(upload, profile?.profilePhotoUrl ? remove : undefined);
  };

  const stats = profile?.stats;
  const ratingCount = (isDriver ? stats?.totalRatingsAsDriver : stats?.totalRatingsAsRider) ?? 0;
  const rating = (isDriver ? stats?.avgRatingAsDriver : stats?.avgRatingAsRider) ?? 0;
  const rides = (isDriver ? stats?.totalRidesAsDriver : stats?.totalRidesAsRider) ?? 0;
  const name = profile?.name ?? '';
  const contact = displayPhone(profile?.phone) ?? profile?.email ?? '';
  const done = completion(profile);
  const kycStatus = (profile?.kyc?.status ?? 'none') as KycStatus;
  const vehicles = profile?.vehicles ?? [];
  const verified = isDriver ? badge?.verified : profile?.isVerified;

  const quick: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'help-circle-outline', label: t('profile.menu.help'), onPress: () => setShowHelp(true) },
    { icon: 'wallet-outline', label: t('profile.menu.walletShort'), onPress: () => navigation.navigate('Wallet') },
    { icon: 'shield-check-outline', label: t('profile.menu.safety'), onPress: () => navigation.navigate('SOS') },
    isDriver
      ? { icon: 'cash', label: t('profile.menu.earnings'), onPress: () => navigation.navigate('Earnings') }
      : { icon: 'receipt-text-outline', label: t('profile.menu.receipts'), onPress: () => navigation.navigate('Receipts') },
  ];

  const identitySub = profile?.identity?.status === 'verified'
    ? t('profile.menu.verified')
    : profile?.identity?.status === 'pending' ? t('profile.waitingForReview') : t('profile.neededForWomenOnlyRides');

  const cards: Card[] = isDriver
    ? [
        {
          icon: 'spiralCalendar',
          label: t('driverProfile.menu.rides'),
          sub: rides > 0 ? (rides === 1 ? t('driverProfile.menu.ridesOne') : t('driverProfile.menu.ridesMany', { count: rides })) : t('driverProfile.menu.ridesNone'),
          onPress: () => navigation.navigate('UpcomingRides'),
        },
        { icon: 'herb', label: t('profile.menu.impact'), sub: (stats?.co2SavedKg ?? 0) > 0 ? t('profile.menu.impactSaved', { amount: formatKg(stats?.co2SavedKg ?? 0) }) : t('profile.menu.impactSub'), onPress: () => navigation.navigate('Impact') },
        { icon: 'roundPushpin', label: t('driverProfile.menu.tracker'), sub: t('driverProfile.menu.trackerSub'), onPress: () => navigation.navigate('CarTracker') },
        { icon: 'telephoneReceiver', label: t('profile.menu.contacts'), sub: t('profile.menu.contactsSub'), onPress: () => navigation.navigate('EmergencyContacts') },
        { icon: 'briefcase', label: t('profile.menu.work'), sub: t('profile.menu.workSub'), onPress: () => navigation.navigate('Work') },
        { icon: 'identificationCard', label: t('profile.menu.identity'), sub: identitySub, onPress: () => navigation.navigate('IdentityCheck') },
        { icon: 'automobile', label: t('profile.switchToRiding'), sub: t('profile.menu.rideSub'), onPress: switchRole },
        { icon: 'gear', label: t('profile.menu.settings'), sub: t('profile.menu.settingsSub'), onPress: () => navigation.navigate('Settings') },
      ]
    : [
        { icon: 'herb', label: t('profile.menu.impact'), sub: (stats?.co2SavedKg ?? 0) > 0 ? t('profile.menu.impactSaved', { amount: formatKg(stats?.co2SavedKg ?? 0) }) : t('profile.menu.impactSub'), onPress: () => navigation.navigate('Impact') },
        { icon: 'briefcase', label: t('profile.menu.work'), sub: t('profile.menu.workSub'), onPress: () => navigation.navigate('Work') },
        { icon: 'telephoneReceiver', label: t('profile.menu.contacts'), sub: t('profile.menu.contactsSub'), onPress: () => navigation.navigate('EmergencyContacts') },
        { icon: 'moneyBag', label: t('profile.driveWithSiham'), sub: t('profile.menu.driveSub'), onPress: switchRole },
        {
          icon: 'spiralCalendar',
          label: t('profile.menu.myRides'),
          sub: rides > 0 ? (rides === 1 ? t('profile.menu.ridesOne') : t('profile.menu.ridesMany', { count: rides })) : t('profile.menu.ridesNone'),
          onPress: () => navigation.navigate('RiderTabs', { screen: 'MyRides' }),
        },
        { icon: 'identificationCard', label: t('profile.menu.identity'), sub: identitySub, onPress: () => navigation.navigate('IdentityCheck') },
        { icon: 'speechBalloon', label: t('profile.menu.messages'), sub: t('profile.menu.messagesSub'), onPress: () => navigation.navigate('Messages') },
        { icon: 'worldMap', label: t('profile.menu.savedRoutes'), sub: t('profile.menu.savedRoutesSub'), onPress: () => navigation.navigate('AddSavedRoute') },
        { icon: 'gear', label: t('profile.menu.settings'), sub: t('profile.menu.settingsSub'), onPress: () => navigation.navigate('Settings') },
      ];

  const kycCard = isDriver && profile && kycStatus !== 'approved' ? (
    <FeatureCard
      card={{
        icon: 'identificationCard',
        label: kycStatus === 'pending'
          ? t('driverProfile.beingReviewed')
          : kycStatus === 'rejected' ? t('driverProfile.resubmitYourDocuments') : t('driverProfile.getVerifiedToOfferRides'),
        sub: kycStatus === 'rejected' && profile.kyc?.rejectionReason
          ? t('driverProfile.reason', { reason: profile.kyc.rejectionReason })
          : t('driverProfile.onlyReviewed'),
        // Nothing to do while the documents are being reviewed
        onPress: kycStatus === 'pending' ? () => undefined : () => navigation.navigate('KYC'),
      }}
      alert={kycStatus === 'rejected'}
    />
  ) : null;

  return (
    <View style={[st.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenGlow />
      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        {/* ── Name, rating and picture ─────────────────────── */}
        <View style={st.header}>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${contact}. Edit profile`}
            style={st.flex1}
          >
            <Text style={[st.bigName, tc.color_text]} numberOfLines={2} accessibilityRole="header">{name || t('profile.profile')}</Text>
            <View style={st.headerMeta}>
              <View
                style={[st.ratingChip, tc.backgroundColor_surfaceVariant]}
                accessibilityLabel={ratingCount > 0 ? t('profile.myRating', { rating: rating.toFixed(1) }) : t('profile.new')}
              >
                <Icon name="star" size={14} color={tk.star} />
                <Text style={[st.ratingChipText, tc.color_text]}>
                  {ratingCount > 0 ? rating.toFixed(1) : `5.0 · ${t('profile.new')}`}
                </Text>
              </View>
              {verified && <Icon name="check-decagram" size={18} color={tk.primary} label={t('profile.verified')} />}
            </View>
            <Text style={[st.phone, tc.color_textSec]} numberOfLines={1}>{contact}</Text>
            {done < 1 && profile && (
              <Text style={[st.complete, tc.color_primary]}>{t('profile.complete', { percent: Math.round(done * 100) })}</Text>
            )}
          </Pressable>
          <AvatarRing
            name={name}
            photoUrl={profile?.profilePhotoUrl}
            progress={done}
            onPress={profile && !savingPhoto ? changePhoto : undefined}
          />
        </View>

        {/* ── Quick tiles ──────────────────────────────────── */}
        <View style={st.quickGrid}>
          {quick.map(q => (
            <Pressable
              key={q.label}
              onPress={q.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [st.quick, { opacity: pressed ? 0.8 : 1 }, tc.backgroundColor_surfaceVariant, tc.cardOutline]}
            >
              <Icon name={q.icon} size={22} color={tk.text} />
              <Text style={[st.quickLabel, tc.color_text]} numberOfLines={1}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        {kycCard}

        {/* ── Verified Driver badge progress (UC-D10) ──────── */}
        {isDriver && kycStatus === 'approved' && badge && !badge.verified ? (
          <View style={[st.panel, tc.backgroundColor_surfaceVariant, tc.cardOutline]}>
            <Text style={[st.featureTitle, tc.color_text]}>{t('driverProfile.earnTheVerifiedBadge')}</Text>
            <Text style={[st.featureSub, { marginBottom: Spacing.sm }, tc.color_textSec]}>{t('driverProfile.ridersSeeAVerifiedBadge')}</Text>
            {badge.checks.map(check => (
              <View key={check.label} style={st.badgeRow} accessible accessibilityLabel={`${check.label}: ${check.met ? 'met' : 'not yet'}, ${check.progress}`}>
                <Icon name={check.met ? 'check-circle' : 'checkbox-blank-circle-outline'} size={20} color={check.met ? tk.primary : tk.textSec} />
                <Text style={[st.flex1, { fontSize: Typography.md }, tc.color_text]}>{check.label}</Text>
                <Text style={[{ fontSize: Typography.sm }, tc.color_textSec]}>{check.progress}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Cards with a 3D picture ─────────────────────── */}
        {cards.map(card => <FeatureCard key={card.label} card={card} />)}

        {/* ── Driver: vehicles and reviews ────────────────── */}
        {isDriver ? (
          <>
            <Text style={[st.sectionTitle, tc.color_text]}>{t('driverProfile.vehicles')}</Text>
            {vehicles.length === 0 ? (
              <Text style={[st.hint, tc.color_textSec]}>{t('driverProfile.yourVehicleIsAddedWhen')}</Text>
            ) : (
              vehicles.map(v => {
                const cat = VEHICLE_CATEGORIES[vehicleCategory(v.vehicleType)];
                return (
                  <View key={v._id} style={[st.featureCard, tc.backgroundColor_surfaceVariant, tc.cardOutline]}>
                    <View style={st.flex1}>
                      <Text style={[st.featureTitle, tc.color_text]} numberOfLines={1}>{v.make} {v.model}</Text>
                      <Text style={[st.featureSub, tc.color_textSec]} numberOfLines={1}>
                        {[v.color, v.plateNumber, v.year, v.hasAC ? 'AC' : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Icon3D name={cat.icon3d} size={56} />
                  </View>
                );
              })
            )}

            <Text style={[st.sectionTitle, tc.color_text]}>{t('driverProfile.recentReviews')}</Text>
            {summary && Object.values(summary.categories).some(v => v !== null) ? (
              <Text style={[st.hint, { marginBottom: Spacing.sm }, tc.color_textSec]}>
                {([['Behaviour', summary.categories.behavior], ['Cleanliness', summary.categories.cleanliness], ['Punctuality', summary.categories.punctuality]] as const)
                  .filter(([, v]) => v !== null)
                  .map(([label, v]) => `${label} ${v?.toFixed(1)}`)
                  .join(' · ')}
              </Text>
            ) : null}
            {reviews.length === 0 ? (
              <Text style={[st.hint, tc.color_textSec]}>{t('driverProfile.reviewsFromYourRidersWill')}</Text>
            ) : (
              reviews.map(r => (
                <View key={r._id} style={[st.panel, tc.backgroundColor_surfaceVariant, tc.cardOutline]}>
                  <View style={st.reviewHeader}>
                    <Text style={[st.featureTitle, st.flex1, tc.color_text]} numberOfLines={1}>{r.rater?.name ?? t('common.rider')}</Text>
                    <View style={st.stars} accessible accessibilityLabel={`${r.score} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Icon key={j} name={j < r.score ? 'star' : 'star-outline'} size={14} color={tk.star} />
                      ))}
                    </View>
                  </View>
                  {r.comment ? <Text style={[st.reviewText, tc.color_text]}>{r.comment}</Text> : null}
                  <Text style={[st.featureSub, tc.color_textSec]}>{timeAgo(r.createdAt)}</Text>
                </View>
              ))
            )}
          </>
        ) : null}

        <Pressable onPress={() => logout()} accessibilityRole="button" style={[st.logout, tc.borderColor_border]}>
          <Icon name="logout" size={22} color={tk.error} />
          <Text style={[st.logoutText, tc.color_error]}>{t('profile.logOut')}</Text>
        </Pressable>

        <Text style={[st.version, tc.color_textSec]}>{t('profile.version', { version: Constants.expoConfig?.version ?? '' })}</Text>
      </ScrollView>

      {/* ── Help sheet ─────────────────────────────────────── */}
      <Modal visible={showHelp} transparent animationType="slide" onRequestClose={() => setShowHelp(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.closeHelp')} style={st.overlay} onPress={() => setShowHelp(false)} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + Spacing.lg }, tc.backgroundColor_surface]}>
          <View style={[st.sheetHandle, tc.backgroundColor_border]} />
          <View style={[st.sheetTitleRow, tc.borderBottomColor_border]}>
            <Text style={[st.sheetTitle, tc.color_text]} accessibilityRole="header">{t('profile.helpAndLegal')}</Text>
            <Pressable
              onPress={() => setShowHelp(false)}
              style={[st.closeBtn, tc.backgroundColor_surfaceVariant]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.close')}
            >
              <Icon name="close" size={18} color={tk.textSec} />
            </Pressable>
          </View>
          <Pressable
            style={st.helpRow}
            accessibilityRole="button"
            onPress={() => {
              setShowHelp(false);
              navigation.navigate('Help');
            }}
          >
            <Icon name="help-circle-outline" size={22} color={tk.textSec} />
            <View style={st.flex1}>
              <Text style={[st.helpTitle, tc.color_text]}>{t('profile.helpCentre')}</Text>
              <Text style={[st.helpSub, tc.color_textSec]}>{t('profile.answersAndRequestsToOur')}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={tk.textSec} />
          </Pressable>
          {HELP_ITEMS.map(item => (
            <Pressable key={item.title} style={st.helpRow} accessibilityRole="link" onPress={() => Linking.openURL(item.url)}>
              <Icon name={item.icon} size={22} color={tk.textSec} />
              <View style={st.flex1}>
                <Text style={[st.helpTitle, tc.color_text]}>{item.title}</Text>
                <Text style={[st.helpSub, tc.color_textSec]}>{item.sub}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={tk.textSec} />
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

/** A card with a 3D picture, as on Uber's account page */
function FeatureCard({ card, alert }: { card: Card; alert?: boolean }) {
  return (
    <Pressable
      onPress={card.onPress}
      accessibilityRole="button"
      accessibilityLabel={card.sub ? `${card.label}, ${card.sub}` : card.label}
      style={({ pressed }) => [
        st.featureCard,
        { opacity: pressed ? 0.85 : 1 },
        tc.backgroundColor_surfaceVariant,
        tc.cardOutline,
        alert && tc.borderColor_error
      ]}
    >
      <View style={st.flex1}>
        <Text style={[st.featureTitle, tc.color_text]}>{card.label}</Text>
        {card.sub ? <Text style={[st.featureSub, alert ? tc.color_error : tc.color_textSec]}>{card.sub}</Text> : null}
      </View>
      <Icon3D name={card.icon} size={56} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.xl },
  bigName: { fontSize: 32, lineHeight: 38, fontWeight: Typography.extrabold },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  ratingChipText: { fontSize: Typography.md, fontWeight: Typography.bold },
  phone: { fontSize: Typography.md, marginTop: 6 },
  complete: { fontSize: Typography.base, fontWeight: Typography.semibold, marginTop: 6 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: Spacing.md, marginBottom: Spacing.lg },
  quick: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingHorizontal: Spacing.lg, borderRadius: Radius.xl },
  quickLabel: { fontSize: Typography.xl, fontWeight: Typography.semibold },

  featureCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 88, padding: Spacing.lg, borderRadius: Radius['2xl'], marginBottom: Spacing.md },
  featureTitle: { fontSize: Typography.xl, fontWeight: Typography.bold },
  featureSub: { fontSize: Typography.md, marginTop: 4, lineHeight: 19 },
  panel: { padding: Spacing.lg, borderRadius: Radius['2xl'], marginBottom: Spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 36 },

  sectionTitle: { fontSize: Typography['3xl'], fontWeight: Typography.bold, marginTop: Spacing.xl, marginBottom: Spacing.md },
  hint: { fontSize: Typography.md, lineHeight: 20 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stars: { flexDirection: 'row', gap: 1 },
  reviewText: { fontSize: Typography.lg, lineHeight: 21, marginTop: 4 },

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

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: Radius['4xl'], borderTopRightRadius: Radius['4xl'] },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: Spacing.md, marginBottom: Spacing.sm },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: Typography['3xl'], fontWeight: Typography.extrabold },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, minHeight: 60, paddingHorizontal: Spacing.xl },
  helpTitle: { fontSize: Typography.lg, fontWeight: Typography.bold },
  helpSub: { fontSize: Typography.base, marginTop: 2 },
});
