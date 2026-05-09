import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { userService } from '../../services/userService';
import { walletService } from '../../services/walletService';
import type { User } from '../../types/api';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── MenuItem sub-component ───────────────────────────────── */
function MenuItem({
  iconBg,
  iconPath,
  iconColor,
  label,
  onPress,
  c,
}: {
  iconBg: string;
  iconPath: string;
  iconColor: string;
  label: string;
  onPress: () => void;
  c: ReturnType<typeof useApp>['c'];
}) {
  return (
    <Pressable onPress={onPress} style={st.menuItem}>
      <View style={[st.menuIcon, { backgroundColor: iconBg }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d={iconPath} fill={iconColor} />
        </Svg>
      </View>
      <Text style={[st.menuLabel, { color: c.text }]}>{label}</Text>
      <Svg width={17} height={17} viewBox="0 0 24 24">
        <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill={c.textSec} />
      </Svg>
    </Pressable>
  );
}

/* ── Help options ────────────────────────────────────────── */
const HELP_ITEMS = [
  { emoji: '💬', title: 'Live Chat Support', sub: 'Chat with us · Avg reply in 2 min' },
  { emoji: '📞', title: 'Call Support', sub: '1800-123-POOL · Available 24/7' },
  { emoji: '📧', title: 'Email Us', sub: 'support@ridepool.in' },
  { emoji: '📖', title: 'FAQs & Help Center', sub: 'Browse common questions' },
  { emoji: '🐛', title: 'Report a Bug', sub: 'Help us improve the app' },
];

/* ── Menu icon paths ─────────────────────────────────────── */
const ICON_BOOKINGS =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
const ICON_PAYMENT =
  'M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z';
const ICON_EMERGENCY =
  'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5zm-1 3v4h2V8h-2zm0 6v2h2v-2h-2z';
const ICON_HELP =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z';
const ICON_SETTINGS =
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z';

/* ═══════════════════════════════════════════════════════════════ */
export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { c, role, logout } = useApp();
  const insets = useSafeAreaInsets();
  const [showHelp, setShowHelp] = useState(false);
  const isDriver = role === 'driver';

  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [totalEarned, setTotalEarned] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchData = async () => {
        try {
          const [profile, wallet] = await Promise.all([
            userService.getMyProfile().catch(() => null),
            walletService.getBalance().catch(() => null)
          ]);
          if (isActive) {
            if (profile) setUserProfile(profile);
            if (wallet) setTotalEarned(wallet.totalEarnings || wallet.balance || 0);
          }
        } catch (error) {
          console.error(error);
        }
      };
      fetchData();
      return () => { isActive = false; };
    }, [])
  );

  const ridesGiven = userProfile?.stats?.totalRidesAsDriver || 0;
  const ridesTaken = userProfile?.stats?.totalRidesAsRider || 0;
  const ratingDriver = userProfile?.stats?.avgRatingAsDriver || 5.0;
  const ratingRider = userProfile?.stats?.avgRatingAsRider || 5.0;
  
  const STATS = [
    { label: isDriver ? 'Rides Given' : 'Rides Taken', value: isDriver ? ridesGiven.toString() : ridesTaken.toString() },
    { label: isDriver ? 'Earned Total' : 'Saved Total', value: `₹${totalEarned.toLocaleString()}` },
    { label: 'CO₂ Saved', value: '142 kg' },
  ];

  return (
    <View style={[st.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <ScrollView style={st.flex1} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {/* ── Header ──────────────────────────────────────────── */}
        <LinearGradient colors={[c.primary, c.primaryDark]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={st.header}>
          <View style={st.headerTop}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: 'white' }}>Profile</Text>
            <Pressable onPress={() => navigation.navigate('Settings' as any)} style={st.settingsBtn}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path d={ICON_SETTINGS} fill="white" />
              </Svg>
            </Pressable>
          </View>

          {/* Profile row */}
          <View style={st.profileRow}>
            <View>
              <ImageWithFallback
                src={
                  userProfile?.profilePhotoUrl || 
                  (isDriver
                    ? 'https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=100&h=100&fit=crop'
                    : 'https://images.unsplash.com/photo-1580746453801-37b0bc56f3b4?w=100&h=100&fit=crop')
                }
                alt="Profile"
                width={72}
                height={72}
                borderRadius={20}
                style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' }}
              />
              <View style={st.editBadge}>
                <Svg width={12} height={12} viewBox="0 0 24 24">
                  <Path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill={c.primary} />
                </Svg>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={st.nameRow}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: 'white' }}>
                  {userProfile?.name || (isDriver ? 'Rajesh Kumar' : 'Priya Sharma')}
                </Text>
                {userProfile?.isVerified && (
                  <View style={[st.verifiedBadge, { backgroundColor: c.success }]}>
                    <Svg width={10} height={10} viewBox="0 0 24 24">
                      <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white" />
                    </Svg>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: 'white' }}>VERIFIED</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                {userProfile?.phone || '+91 98765 43210'} · {isDriver ? 'Driver' : 'Rider'}
              </Text>
              <View style={st.ratingRow}>
                <Svg width={13} height={13} viewBox="0 0 24 24">
                  <Path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="#FFB300" />
                </Svg>
                <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>
                  {isDriver ? ratingDriver : ratingRider}
                </Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  {isDriver ? `${ridesGiven} rides driven` : `${ridesTaken} rides taken`}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Stats card (overlapping header) ─────────────────── */}
        <View style={st.statsWrap}>
          <View style={[st.statsCard, { backgroundColor: c.surface, borderColor: c.border, ...Shadow }]}>
            {STATS.map((stat, i) => (
              <View
                key={i}
                style={[
                  st.statCol,
                  i < 2 && { borderRightWidth: 1, borderRightColor: c.border },
                ]}
              >
                <Text style={{ fontSize: 20, fontWeight: '800', color: c.primary }}>{stat.value}</Text>
                <Text style={{ fontSize: 11, color: c.textSec, textAlign: 'center' }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Menu items ──────────────────────────────────────── */}
        <View style={st.menuSection}>
          <View style={[st.menuCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <MenuItem c={c} iconBg="#EEF2FF" iconColor="#4F46E5" iconPath={ICON_BOOKINGS} label="My Bookings" onPress={() => navigation.navigate('MyRides' as any)} />
            <View style={[st.divider, { backgroundColor: c.border }]} />
            <MenuItem c={c} iconBg="#ECFDF5" iconColor="#10B981" iconPath={ICON_PAYMENT} label="Payment Methods" onPress={() => navigation.navigate('Payment' as any)} />
            <View style={[st.divider, { backgroundColor: c.border }]} />
            <MenuItem c={c} iconBg="#FEF2F2" iconColor="#EF4444" iconPath={ICON_EMERGENCY} label="Emergency Contacts" onPress={() => navigation.navigate('EmergencyContacts' as any)} />
            <View style={[st.divider, { backgroundColor: c.border }]} />
            <MenuItem c={c} iconBg="#F3F4F6" iconColor="#6B7280" iconPath={ICON_HELP} label="Help & Support" onPress={() => setShowHelp(true)} />
          </View>
        </View>

        {/* ── Log Out ─────────────────────────────────────────── */}
        <View style={st.logoutWrap}>
          <Pressable onPress={() => logout()} style={st.logoutBtn}>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" fill="#E11D48" />
            </Svg>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#E11D48' }}>Log Out</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 12, color: c.textSec, textAlign: 'center', paddingBottom: 16 }}>
          RidePool v1.0.0 · Made with ❤️ in India
        </Text>
      </ScrollView>

      {/* ── Help & Support modal ──────────────────────────────── */}
      <Modal visible={showHelp} transparent animationType="slide" onRequestClose={() => setShowHelp(false)}>
        <Pressable style={st.overlay} onPress={() => setShowHelp(false)} />
        <View style={st.sheet}>
          <View style={st.sheetHandle} />
          <View style={st.sheetTitleRow}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Help & Support</Text>
            <Pressable onPress={() => setShowHelp(false)} style={st.closeBtn}>
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#6B7280" />
              </Svg>
            </Pressable>
          </View>
          <View style={st.sheetBody}>
            {HELP_ITEMS.map(item => (
              <Pressable key={item.title} style={st.helpRow}>
                <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{item.sub}</Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="#9CA3AF" />
                </Svg>
              </Pressable>
            ))}
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
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  settingsBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  editBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 20 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },

  /* Stats */
  statsWrap: { paddingHorizontal: 20, marginTop: -16 },
  statsCard: { borderRadius: 16, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  statCol: { flex: 1, alignItems: 'center', paddingVertical: 16 },

  /* Menu */
  menuSection: { paddingHorizontal: 20, marginTop: 20 },
  menuCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, paddingHorizontal: 20 },
  menuIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  divider: { height: 1, marginLeft: 72 },

  /* Logout */
  logoutWrap: { paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },
  logoutBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  /* Modal */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginTop: 12, marginBottom: 16 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sheetBody: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
});
