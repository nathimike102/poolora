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
import { errorHandler } from '../../utils/errorHandler';
import { COMPANY } from '../../config/company';
import type { User } from '../../types/api';
import Constants from 'expo-constants';
import { realPhone } from '../../utils/phone';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── Icon paths ──────────────────────────────────────────── */
const IC_EDIT = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
const IC_PEOPLE = 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z';
const IC_WALLET = 'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
const IC_SHIELD = 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5zm-1 3v4h2V8h-2zm0 6v2h2v-2h-2z';
const IC_MOON = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
const IC_BELL = 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z';
const IC_HELP = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z';
const IC_CHECK_CIRCLE = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
const IC_LOGOUT = 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z';
const IC_CHEVRON = 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z';
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

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useFocusEffect(
    useCallback(() => {
      userService.getMyProfile().then(setProfile).catch(() => undefined);
      walletService.getBalance().then(w => setWalletBalance(w.balance)).catch(() => setWalletBalance(null));
    }, []),
  );

  const openEditProfile = () => {
    setProfileName(profile?.name ?? '');
    setProfileEmail(profile?.email ?? '');
    setSaveError('');
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (profileName.trim().length < 2) {
      setSaveError('Enter your full name.');
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
        <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>Settings</Text>
      </View>

      {/* ── Body ────────────────────────────────────────────── */}
      <ScrollView style={st.flex1} contentContainerStyle={st.scrollBody} showsVerticalScrollIndicator={false}>
        {/* ACCOUNT */}
        <Section title="ACCOUNT" c={c}>
          <SettingsRow c={c} iconBg="#E8EEF9" iconColor="#2B6CC4" iconPath={IC_EDIT} label="Edit profile" onPress={openEditProfile} />
          <Divider c={c} />
          <SettingsRow c={c} iconBg="#E3F2F1" iconColor="#0B7A75" iconPath={IC_PEOPLE} label={isDriver ? 'Switch to Rider' : 'Switch to Driver'} onPress={switchRole} />
        </Section>

        {profile?.capabilities?.includes('admin') && (
          <Section title="ADMIN" c={c}>
            <SettingsRow c={c} iconBg="#E8EEF9" iconColor="#2B6CC4" iconPath={IC_SHIELD} label="Admin tools" onPress={() => navigation.navigate('AdminDashboard')} />
          </Section>
        )}

        {/* WALLET */}
        <Section title="WALLET" c={c}>
          <SettingsRow
            c={c}
            iconBg="#FFFBEB"
            iconColor="#8A5A00"
            iconPath={IC_WALLET}
            label="Wallet balance"
            rightEl={
              <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>
                {walletBalance === null ? 'Unavailable' : `₹${walletBalance.toLocaleString('en-IN')}`}
              </Text>
            }
          />
        </Section>

        {/* SAFETY */}
        <Section title="SAFETY" c={c}>
          <SettingsRow c={c} iconBg="#FEF2F2" iconColor="#B42318" iconPath={IC_SHIELD} label="Emergency contacts" onPress={() => navigation.navigate('EmergencyContacts')} />
        </Section>

        {/* PREFERENCES */}
        <Section title="PREFERENCES" c={c}>
          <SettingsRow
            c={c}
            iconBg={darkMode ? '#10302E' : '#E3F2F1'}
            iconColor={darkMode ? '#5CC5BE' : '#0B7A75'}
            iconPath={IC_MOON}
            label="Dark mode"
            onPress={toggleDarkMode}
            rightEl={<Switch value={darkMode} onValueChange={toggleDarkMode} trackColor={{ false: '#D1D5DB', true: c.primary }} thumbColor="white" />}
          />
          <Divider c={c} />
          <SettingsRow c={c} iconBg="#FFFBEB" iconColor="#8A5A00" iconPath={IC_BELL} label="Notifications" onPress={() => navigation.navigate('Notifications')} />
        </Section>

        {/* ABOUT */}
        <Section title="ABOUT" c={c}>
          <SettingsRow c={c} iconBg="#F3F4F6" iconColor="#4B5563" iconPath={IC_HELP} label="Privacy policy" onPress={() => Linking.openURL(COMPANY.privacyUrl)} />
          <Divider c={c} />
          <SettingsRow c={c} iconBg="#F3F4F6" iconColor="#4B5563" iconPath={IC_HELP} label="Terms of service" onPress={() => Linking.openURL(COMPANY.termsUrl)} />
          <Divider c={c} />
          <SettingsRow
            c={c}
            iconBg="#F0FDF4"
            iconColor="#1B7F3B"
            iconPath={IC_CHECK_CIRCLE}
            label="App version"
            rightEl={<Text style={{ fontSize: 13, color: c.textSec }}>{Constants.expoConfig?.version ?? ''}</Text>}
          />
          <Divider c={c} />
          <SettingsRow c={c} iconBg="#FEF2F2" iconColor="#B42318" iconPath={IC_LOGOUT} label="Log out" onPress={() => logout()} />
        </Section>
      </ScrollView>

      {/* ── Edit Profile Modal ────────────────────────────────── */}
      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <Pressable accessibilityRole="button" style={st.overlay} onPress={() => setShowEditProfile(false)} />
        <View style={[st.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom }]}>
          <View style={[st.sheetHandle, { backgroundColor: c.border }]} />

          {/* Title row */}
          <View style={[st.sheetTitleRow, { borderBottomColor: c.border }]}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: c.text }} accessibilityRole="header">Edit profile</Text>
            <Pressable
              onPress={() => setShowEditProfile(false)}
              style={[st.closeBtn, { backgroundColor: c.bg }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path d={IC_CLOSE} fill={c.textSec} />
              </Svg>
            </Pressable>
          </View>

          <View style={st.sheetBody}>
            {/* Inputs */}
            {([
              { label: 'Full name', value: profileName, setter: setProfileName, kb: 'default' as const, ac: 'name' as const },
              { label: 'Email address (optional)', value: profileEmail, setter: setProfileEmail, kb: 'email-address' as const, ac: 'email' as const },
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
              <Text style={[st.fieldLabel, { color: c.textSec }]}>Phone number</Text>
              <Text style={{ fontSize: 15, color: c.text }}>{realPhone(profile?.phone) ?? 'Not added'}</Text>
              <Text style={{ fontSize: 12, color: c.textSec, marginTop: 2 }}>
                Your phone number is verified at sign-in and can't be changed here.
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
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>Save changes</Text>
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
