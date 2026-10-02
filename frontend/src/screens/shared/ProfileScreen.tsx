/**
 * screens/shared/ProfileScreen.tsx
 *
 * The rider's account at a glance: a card with their name, phone and rating,
 * then one list for everything else (rides, wallet, safety, help, settings).
 */

import React, { useCallback, useState } from 'react';
import { Linking, View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { userService } from '../../services/userService';
import type { User } from '../../types/api';
import { useApp } from '../../context/AppContext';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import type { RootStackParamList } from '../../navigation/types';
import { Icon, type IconName } from '../../components/Icon';
import { COMPANY } from '../../config/company';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import { displayPhone, realPhone } from '../../utils/phone';
import { formatKg } from '../../utils/carbon';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const HELP_ITEMS: { icon: IconName; title: string; sub: string; url: string }[] = [
  // Words are read from the catalogue when shown, so they follow the language
  { icon: 'phone-outline', get title() { return i18n.t('profile.help.call'); }, get sub() { return i18n.t('profile.help.callSub', { phone: COMPANY.supportPhoneDisplay }); }, url: `tel:${COMPANY.supportPhone}` },
  { icon: 'email-outline', get title() { return i18n.t('profile.help.email'); }, sub: COMPANY.supportEmail, url: `mailto:${COMPANY.supportEmail}` },
  { icon: 'shield-lock-outline', get title() { return i18n.t('profile.help.privacy'); }, get sub() { return i18n.t('profile.help.privacySub'); }, url: COMPANY.privacyUrl },
  { icon: 'file-document-outline', get title() { return i18n.t('profile.help.terms'); }, get sub() { return i18n.t('profile.help.termsSub'); }, url: COMPANY.termsUrl },
];

/** Share of the profile that's filled in, for the ring around the avatar. */
function completion(p: User | null): number {
  if (!p) return 0;
  const fields = [p.name, realPhone(p.phone), p.email, p.profilePhotoUrl, p.gender, (p.emergencyContacts?.length ?? 0) > 0];
  return fields.filter(Boolean).length / fields.length;
}

export function ProfileScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { c, role, logout, switchRole } = useApp();
  const insets = useSafeAreaInsets();
  const [showHelp, setShowHelp] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const isDriver = role === 'driver';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      userService
        .getMyProfile()
        .then(p => { if (active) setProfile(p); })
        .catch(() => {});
      return () => { active = false; };
    }, []),
  );

  const stats = profile?.stats;
  const ratingCount = (isDriver ? stats?.totalRatingsAsDriver : stats?.totalRatingsAsRider) ?? 0;
  const rating = (isDriver ? stats?.avgRatingAsDriver : stats?.avgRatingAsRider) ?? 0;
  const rides = (isDriver ? stats?.totalRidesAsDriver : stats?.totalRidesAsRider) ?? 0;
  const name = profile?.name ?? '';
  const contact = displayPhone(profile?.phone) ?? profile?.email ?? '';
  const done = completion(profile);

  const menu: { icon: IconName; label: string; sub?: string; onPress: () => void }[] = [
    { icon: 'help-circle-outline', label: t('profile.menu.help'), onPress: () => setShowHelp(true) },
    { icon: 'wallet-outline', label: t('profile.menu.wallet'), onPress: () => navigation.navigate('Settings') },
    ...(!isDriver
      ? [{ icon: 'history' as IconName, label: t('profile.menu.myRides'), sub: rides > 0 ? (rides === 1 ? t('profile.menu.ridesOne') : t('profile.menu.ridesMany', { count: rides })) : undefined, onPress: () => navigation.navigate('RiderTabs', { screen: 'MyRides' }) }]
      : []),
    { icon: 'shield-check-outline', label: t('profile.menu.safety'), onPress: () => navigation.navigate('SOS') },
    { icon: 'account-heart-outline', label: t('profile.menu.contacts'), sub: t('profile.menu.contactsSub'), onPress: () => navigation.navigate('EmergencyContacts') },
    { icon: 'card-account-details-star-outline', label: t('profile.menu.identity'), sub: profile?.identity?.status === 'verified' ? t('profile.menu.verified') : profile?.identity?.status === 'pending' ? t('profile.waitingForReview') : t('profile.neededForWomenOnlyRides'), onPress: () => navigation.navigate('IdentityCheck') },
    { icon: 'leaf', label: t('profile.menu.impact'), sub: (stats?.co2SavedKg ?? 0) > 0 ? t('profile.menu.impactSaved', { amount: formatKg(stats?.co2SavedKg ?? 0) }) : t('profile.menu.impactSub'), onPress: () => navigation.navigate('Impact') },
    { icon: 'message-text-outline', label: t('profile.menu.messages'), onPress: () => navigation.navigate('Messages') },
    { icon: 'map-marker-path', label: t('profile.menu.savedRoutes'), onPress: () => navigation.navigate('AddSavedRoute') },
    {
      icon: 'steering',
      label: isDriver ? t('profile.switchToRiding') : t('profile.driveWithPoolora'),
      sub: isDriver ? undefined : t('profile.menu.driveSub'),
      onPress: switchRole,
    },
    { icon: 'cog-outline', label: t('profile.menu.settings'), onPress: () => navigation.navigate('Settings') },
  ];

  return (
    <View style={[st.root, { backgroundColor: c.surface, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        <Text style={[st.title, { color: c.text }]} accessibilityRole="header">{t('profile.profile')}</Text>

        {/* ── Account card ─────────────────────────────────── */}
        <View style={[st.card, { backgroundColor: c.surface, borderColor: c.border }, Shadow.md]}>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${contact}. Edit profile`}
            style={st.cardRow}
          >
            <View
              style={[st.ring, { borderColor: done >= 1 ? c.success : c.primary, borderStyle: done >= 1 ? 'solid' : 'dashed' }]}
              accessibilityLabel={t('profile.complete', { percent: Math.round(done * 100) })}
            >
              {profile?.profilePhotoUrl ? (
                <ImageWithFallback src={profile.profilePhotoUrl} alt={name} width={56} height={56} borderRadius={28} />
              ) : (
                <View style={[st.avatar, { backgroundColor: c.primaryLight }]}>
                  {name ? (
                    <Text style={[st.avatarText, { color: c.primary }]}>{name.charAt(0).toUpperCase()}</Text>
                  ) : (
                    <Icon name="account" size={30} color={c.primary} />
                  )}
                </View>
              )}
            </View>
            <View style={st.flex1}>
              <View style={st.nameRow}>
                <Text style={[st.name, { color: c.text }]} numberOfLines={1}>{name || ' '}</Text>
                {profile?.isVerified && <Icon name="check-decagram" size={18} color={c.success} label={t('profile.verified')} />}
              </View>
              <Text style={[st.phone, { color: c.textSec }]}>{contact}</Text>
              {done < 1 && profile && (
                <Text style={[st.complete, { color: c.primary }]}>{t('profile.complete', { percent: Math.round(done * 100) })}</Text>
              )}
            </View>
            <Icon name="chevron-right" size={24} color={c.textSec} />
          </Pressable>
          <View style={[st.cardDivider, { backgroundColor: c.border }]} />
          <View style={st.cardRow}>
            <Icon name="star" size={24} color="#F5B301" />
            <Text style={[st.ratingText, { color: c.text }]}>
              {ratingCount > 0 ? t('profile.myRating', { rating: rating.toFixed(1) }) : t('profile.noRatings')}
            </Text>
            {ratingCount > 0 && (
              <Text style={[st.ratingCount, { color: c.textSec }]}>
                {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
              </Text>
            )}
          </View>
        </View>

        {/* ── Menu ─────────────────────────────────────────── */}
        <View style={st.menu}>
          {menu.map((m, i) => (
            <Pressable
              key={m.label}
              onPress={m.onPress}
              accessibilityRole="button"
              accessibilityLabel={m.sub ? `${m.label}, ${m.sub}` : m.label}
              style={({ pressed }) => [
                st.menuRow,
                i < menu.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
                pressed && { backgroundColor: c.surfaceVariant },
              ]}
            >
              <Icon name={m.icon} size={26} color={c.textSec} />
              <View style={st.flex1}>
                <Text style={[st.menuLabel, { color: c.text }]}>{m.label}</Text>
                {m.sub ? <Text style={[st.menuSub, { color: c.textSec }]}>{m.sub}</Text> : null}
              </View>
              <Icon name="chevron-right" size={24} color={c.textSec} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => logout()} accessibilityRole="button" style={[st.logout, { borderColor: c.border }]}>
          <Icon name="logout" size={22} color={c.error} />
          <Text style={[st.logoutText, { color: c.error }]}>{t('profile.logOut')}</Text>
        </Pressable>

        <Text style={[st.version, { color: c.textSec }]}>{t('profile.version', { version: Constants.expoConfig?.version ?? '' })}</Text>
      </ScrollView>

      {/* ── Help sheet ─────────────────────────────────────── */}
      <Modal visible={showHelp} transparent animationType="slide" onRequestClose={() => setShowHelp(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.closeHelp')} style={st.overlay} onPress={() => setShowHelp(false)} />
        <View style={[st.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={[st.sheetHandle, { backgroundColor: c.border }]} />
          <View style={[st.sheetTitleRow, { borderBottomColor: c.border }]}>
            <Text style={[st.sheetTitle, { color: c.text }]} accessibilityRole="header">{t('profile.helpAndLegal')}</Text>
            <Pressable
              onPress={() => setShowHelp(false)}
              style={[st.closeBtn, { backgroundColor: c.surfaceVariant }]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.close')}
            >
              <Icon name="close" size={18} color={c.textSec} />
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
            <Icon name="help-circle-outline" size={22} color={c.textSec} />
            <View style={st.flex1}>
              <Text style={[st.helpTitle, { color: c.text }]}>{t('profile.helpCentre')}</Text>
              <Text style={[st.helpSub, { color: c.textSec }]}>{t('profile.answersAndRequestsToOur')}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={c.textSec} />
          </Pressable>
          {HELP_ITEMS.map(item => (
            <Pressable key={item.title} style={st.helpRow} accessibilityRole="link" onPress={() => Linking.openURL(item.url)}>
              <Icon name={item.icon} size={22} color={c.textSec} />
              <View style={st.flex1}>
                <Text style={[st.helpTitle, { color: c.text }]}>{item.title}</Text>
                <Text style={[st.helpSub, { color: c.textSec }]}>{item.sub}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={c.textSec} />
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  title: { fontSize: Typography['6xl'], fontWeight: Typography.extrabold, marginTop: Spacing.lg, marginBottom: Spacing.xl },

  card: { borderRadius: Radius['2xl'], borderWidth: 1, paddingHorizontal: Spacing.lg },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg },
  cardDivider: { height: 1 },
  ring: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: Typography.bold },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: Typography['3xl'], fontWeight: Typography.bold },
  phone: { fontSize: Typography.lg, marginTop: 2 },
  complete: { fontSize: Typography.base, fontWeight: Typography.semibold, marginTop: 4 },
  ratingText: { flex: 1, fontSize: Typography.xl, fontWeight: Typography.semibold },
  ratingCount: { fontSize: Typography.md },

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
