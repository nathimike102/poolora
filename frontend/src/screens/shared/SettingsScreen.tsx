import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { userService } from '../../services/userService';
import { walletService } from '../../services/walletService';
import { simulationService } from '../../services/simulationService';
import * as Location from 'expo-location';
import { errorHandler } from '../../utils/errorHandler';
import { COMPANY } from '../../config/company';
import type { User } from '../../types/api';
import Constants from 'expo-constants';
import { displayPhone } from '../../utils/phone';
import { money } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, offeredLanguages, type LanguageCode } from '../../i18n/languages';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── Icon paths ──────────────────────────────────────────── */
const IC_EDIT = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
const IC_PEOPLE = 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z';
const IC_WALLET = 'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
const IC_SHIELD = 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5zm-1 3v4h2V8h-2zm0 6v2h2v-2h-2z';
const IC_MOON = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
const IC_GLOBE = 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.08 16zm2.95-8H5.08a7.99 7.99 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z';
const IC_BELL = 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z';
const IC_HELP = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z';
const IC_CHECK_CIRCLE = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
const IC_LOGOUT = 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z';
const IC_CHEVRON = 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z';
const IC_PLAY = 'M8 5v14l11-7z';
const IC_CLOSE = 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

/* ── Sub-components ──────────────────────────────────────── */
function SettingsRow({
  iconBg,
  iconPath,
  iconColor,
  label,
  value,
  onPress,
  rightEl,
  c,
}: {
  iconBg: string;
  iconPath: string;
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightEl?: React.ReactNode;
  c: ReturnType<typeof useApp>['c'];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={st.row}
    >
      <View style={[st.rowIcon, { backgroundColor: iconBg }]}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d={iconPath} fill={iconColor} />
        </Svg>
      </View>
      <Text style={[st.rowLabel, { color: c.text }]}>{label}</Text>
      {!!value && <Text style={{ fontSize: 14, fontWeight: '500', color: c.textSec, marginRight: 4 }}>{value}</Text>}
      {rightEl ?? (onPress && (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d={IC_CHEVRON} fill={c.textSec} />
        </Svg>
      ))}
    </Pressable>
  );
}

function Section({ title, children, c }: { title: string; children: React.ReactNode; c: ReturnType<typeof useApp>['c'] }) {
  return (
    <View style={st.section}>
      <Text style={[st.sectionTitle, { color: c.textSec }]}>{title}</Text>
      <View style={[st.sectionCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        {children}
      </View>
    </View>
  );
}

function Divider({ c }: { c: ReturnType<typeof useApp>['c'] }) {
  return <View style={[st.divider, { backgroundColor: c.border }]} />;
}

/* ═══════════════════════════════════════════════════════════════ */
export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { c, role, isDarkMode, toggleDarkMode, switchRole, logout } = useApp();
  const insets = useSafeAreaInsets();
  const isDriver = role === 'driver';
  const darkMode = isDarkMode;
  const { t, i18n } = useTranslation();
  // Hidden while English is the only reviewed language: nothing to choose
  const languages = offeredLanguages();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [simulatingAs, setSimulatingAs] = useState<'rider' | 'driver' | null>(null);
  const [closing, setClosing] = useState(false);

  // Closing the account (data protection: the right to erasure)
  const closeAccount = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const check = await userService.getClosureCheck();
      if (!check.canClose) {
        Alert.alert(t('settings.youCannotCloseYourAccount'), check.blockers.join('\n\n'));
        return;
      }
      const coins = check.coinsValue > 0
        ? t('settings.closing.coinsValue', { coins: check.coins, value: money(check.coinsValue) })
        : check.coins > 0 ? t('settings.closing.coins', { coins: check.coins }) : '';
      Alert.alert(
        t('settings.closeYourAccount'),
        t('settings.closing.body', { coins }),
        [
          { text: t('settings.keepMyAccount'), style: 'cancel' },
          {
            text: t('settings.closeAccount'),
            style: 'destructive',
            onPress: async () => {
              try {
                await userService.closeAccount();
                Alert.alert(t('settings.accountClosed'), t('settings.yourAccountHasBeenClosed'));
                await logout();
              } catch (error) {
                Alert.alert(t('settings.couldNotCloseYourAccount'), errorHandler.process(error).message);
              }
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(t('settings.couldNotCheckYourAccount'), errorHandler.process(error).message);
    } finally {
      setClosing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      simulationService.isEnabled().then(setSimulationEnabled);
      userService.getMyProfile().then(setProfile).catch(() => undefined);
      walletService.getBalance().then(w => setWalletBalance(w.balance)).catch(() => setWalletBalance(null));
    }, []),
  );

  /** Start a simulated ride from where the phone is (or a default spot). */
  const simulate = async (as: 'rider' | 'driver') => {
    setSimulatingAs(as);
    try {
      let near: { lat: number; lng: number } | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          near = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch {
        // The server starts the ride at the market's centre instead
      }
      if (as === 'rider') {
        const { rideId, bookingId } = await simulationService.asRider(near);
        navigation.navigate('ActiveRide', { rideId, bookingId });
      } else {
        const { rideId } = await simulationService.asDriver(near);
        navigation.navigate('DriverRideDetails', { rideId });
        Alert.alert(
          t('settings.aTestRiderWantsA'),
          t('settings.simRiderAskedToJoin'),
        );
      }
    } catch (error) {
      Alert.alert(t('settings.couldNotStartTheSimulation'), errorHandler.process(error).message);
    } finally {
      setSimulatingAs(null);
    }
  };

  const openEditProfile = () => {
    setProfileName(profile?.name ?? '');
    setProfileEmail(profile?.email ?? '');
    setSaveError('');
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (profileName.trim().length < 2) {
      setSaveError(t('settings.enterName'));
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const updated = await userService.updateMyProfile({
        name: profileName.trim(),
        email: profileEmail.trim() || null,
      });
      setProfile(updated);
      setShowEditProfile(false);
    } catch (error) {
      setSaveError(errorHandler.process(error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[st.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[st.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>{t('settings.settings')}</Text>
      </View>

      {/* ── Body ────────────────────────────────────────────── */}
      <ScrollView style={st.flex1} contentContainerStyle={st.scrollBody} showsVerticalScrollIndicator={false}>
        {/* ACCOUNT */}
        <Section title={t('settings.account')} c={c}>
          <SettingsRow c={c} iconBg="#E8EEF9" iconColor="#2B6CC4" iconPath={IC_EDIT} label={t('settings.editProfile')} onPress={openEditProfile} />
          <Divider c={c} />
          <SettingsRow c={c} iconBg="#E3F2F1" iconColor="#0B7A75" iconPath={IC_PEOPLE} label={isDriver ? t('settings.switchToRider') : t('settings.switchToDriver')} onPress={switchRole} />
        </Section>

        {profile?.capabilities?.includes('admin') && (
          <Section title={t('settings.admin')} c={c}>
            <SettingsRow c={c} iconBg="#E8EEF9" iconColor="#2B6CC4" iconPath={IC_SHIELD} label={t('settings.adminTools')} onPress={() => navigation.navigate('AdminDashboard')} />
          </Section>
        )}

        {/* WALLET */}
        <Section title={t('settings.wallet')} c={c}>
          <SettingsRow
            c={c}
            iconBg="#FFFBEB"
            iconColor="#8A5A00"
            iconPath={IC_WALLET}
            label={t('settings.wallet2')}
            onPress={() => navigation.navigate('Wallet')}
            rightEl={
              <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>
                {walletBalance === null ? t('common.unavailable') : `${money(walletBalance)}`}
              </Text>
            }
          />
        </Section>

        {/* SAFETY */}
        <Section title={t('settings.safety')} c={c}>
          <SettingsRow c={c} iconBg="#FEF2F2" iconColor="#B42318" iconPath={IC_SHIELD} label={t('settings.emergencyContacts')} onPress={() => navigation.navigate('EmergencyContacts')} />
        </Section>

        {/* TESTING (development servers only) */}
        {simulationEnabled && (
          <Section title={t('settings.testing')} c={c}>
            <SettingsRow
              c={c}
              iconBg="#E3F2F1"
              iconColor="#0B7A75"
              iconPath={IC_PLAY}
              label={t('settings.simulateARideAsRider')}
              value={simulatingAs === 'rider' ? 'Starting…' : undefined}
              onPress={simulatingAs ? undefined : () => simulate('rider')}
            />
            <Divider c={c} />
            <SettingsRow
              c={c}
              iconBg="#E8EEF9"
              iconColor="#2B6CC4"
              iconPath={IC_PLAY}
              label={t('settings.simulateARideAsDriver')}
              value={simulatingAs === 'driver' ? 'Starting…' : undefined}
              onPress={simulatingAs ? undefined : () => simulate('driver')}
            />
          </Section>
        )}

        {/* PREFERENCES */}
        <Section title={t('settings.preferences')} c={c}>
          <SettingsRow
            c={c}
            iconBg={darkMode ? '#10302E' : '#E3F2F1'}
            iconColor={darkMode ? '#5CC5BE' : '#0B7A75'}
            iconPath={IC_MOON}
            label={t('settings.darkMode')}
            onPress={toggleDarkMode}
            rightEl={<Switch value={darkMode} onValueChange={toggleDarkMode} trackColor={{ false: '#D1D5DB', true: c.primary }} thumbColor="white" />}
          />
          {languages.length > 1 ? (
            <>
              <Divider c={c} />
              <SettingsRow
                c={c}
                iconBg="#EEF2FF"
                iconColor="#3730A3"
                iconPath={IC_GLOBE}
                label={t('language.title')}
                value={LANGUAGES[i18n.language as LanguageCode]?.nativeName}
                onPress={() => navigation.navigate('Language')}
              />
            </>
          ) : null}
          <Divider c={c} />
          <SettingsRow c={c} iconBg="#FFFBEB" iconColor="#8A5A00" iconPath={IC_BELL} label={t('settings.notifications')} onPress={() => navigation.navigate('Notifications')} />
        </Section>

        {/* ABOUT */}
        <Section title={t('settings.about')} c={c}>
          <SettingsRow c={c} iconBg="#F3F4F6" iconColor="#4B5563" iconPath={IC_HELP} label={t('settings.privacyPolicy')} onPress={() => Linking.openURL(COMPANY.privacyUrl)} />
          <Divider c={c} />
          <SettingsRow c={c} iconBg="#F3F4F6" iconColor="#4B5563" iconPath={IC_HELP} label={t('settings.termsOfService')} onPress={() => Linking.openURL(COMPANY.termsUrl)} />
          <Divider c={c} />
          <SettingsRow
            c={c}
            iconBg="#F0FDF4"
            iconColor="#1B7F3B"
            iconPath={IC_CHECK_CIRCLE}
            label={t('settings.appVersion')}
            rightEl={<Text style={{ fontSize: 13, color: c.textSec }}>{Constants.expoConfig?.version ?? ''}</Text>}
          />
          <Divider c={c} />
          <SettingsRow c={c} iconBg="#FEF2F2" iconColor="#B42318" iconPath={IC_LOGOUT} label={t('settings.logOut')} onPress={() => logout()} />
          <Divider c={c} />
          <SettingsRow
            c={c}
            iconBg="#FEF2F2"
            iconColor="#B42318"
            iconPath={IC_LOGOUT}
            label={t('settings.closeAccount')}
            rightEl={closing ? <ActivityIndicator size="small" color={c.textSec} /> : undefined}
            onPress={closeAccount}
          />
        </Section>
      </ScrollView>

      {/* ── Edit Profile Modal ────────────────────────────────── */}
      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <Pressable accessibilityRole="button" style={st.overlay} onPress={() => setShowEditProfile(false)} />
        <View style={[st.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom }]}>
          <View style={[st.sheetHandle, { backgroundColor: c.border }]} />

          {/* Title row */}
          <View style={[st.sheetTitleRow, { borderBottomColor: c.border }]}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: c.text }} accessibilityRole="header">{t('settings.editProfile')}</Text>
            <Pressable
              onPress={() => setShowEditProfile(false)}
              style={[st.closeBtn, { backgroundColor: c.bg }]}
              accessibilityRole="button"
              accessibilityLabel={t('settings.close')}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path d={IC_CLOSE} fill={c.textSec} />
              </Svg>
            </Pressable>
          </View>

          <View style={st.sheetBody}>
            {/* Inputs */}
            {([
              { label: t('settings.fullName'), value: profileName, setter: setProfileName, kb: 'default' as const, ac: 'name' as const },
              { label: t('settings.emailOptional'), value: profileEmail, setter: setProfileEmail, kb: 'email-address' as const, ac: 'email' as const },
            ]).map(f => (
              <View key={f.label}>
                <Text style={[st.fieldLabel, { color: c.textSec }]}>{f.label}</Text>
                <TextInput
                  value={f.value}
                  onChangeText={f.setter}
                  keyboardType={f.kb}
                  autoComplete={f.ac}
                  autoCapitalize={f.kb === 'email-address' ? 'none' : 'words'}
                  accessibilityLabel={f.label}
                  style={[st.fieldInput, { borderColor: c.border, backgroundColor: c.bg, color: c.text }]}
                />
              </View>
            ))}
            <View>
              <Text style={[st.fieldLabel, { color: c.textSec }]}>{t('settings.phoneNumber')}</Text>
              <Text style={{ fontSize: 15, color: c.text }}>{displayPhone(profile?.phone) ?? t('settings.notAdded')}</Text>
              <Text style={{ fontSize: 12, color: c.textSec, marginTop: 2 }}>
                {t('settings.yourPhoneNumberIsVerified')}
              </Text>
            </View>
            {saveError ? (
              <Text style={{ fontSize: 13, color: c.error }} accessibilityLiveRegion="polite">{saveError}</Text>
            ) : null}

            {/* Save */}
            <Pressable
              onPress={handleSaveProfile}
              disabled={saving}
              style={[st.saveBtnWrap, st.saveBtn, { backgroundColor: c.primary }]}
              accessibilityRole="button"
              accessibilityState={{ busy: saving }}
            >
              {saving ? (
                <ActivityIndicator color={c.textOnPrimary} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>{t('settings.saveChanges')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const st = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1 },

  /* Scroll */
  scrollBody: { paddingTop: 20, paddingBottom: 40, gap: 20 },

  /* Section */
  section: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, paddingLeft: 4 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },

  /* Row */
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, paddingHorizontal: 16 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  divider: { height: 1, marginLeft: 68 },

  /* Modal */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 12, marginBottom: 4 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 16 },

  /* Avatar */
  avatarCenter: { alignItems: 'center', marginBottom: 4 },
  editDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },

  /* Fields */
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  fieldInput: { height: 48, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15, fontWeight: '500' },

  /* Save */
  saveBtnWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  saveBtn: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
