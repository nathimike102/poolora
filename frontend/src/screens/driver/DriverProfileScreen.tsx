import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Image,
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
import { getVehicles, deleteVehicle, type Vehicle } from '../../services/vehicleService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STAR_PATH = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

const DOCS = [
  { label: 'Driving License', status: 'verified' as const },
  { label: 'Vehicle Registration', status: 'verified' as const },
  { label: 'Insurance', status: 'uploaded' as const },
  { label: 'Aadhaar Card', status: 'rejected' as const },
  { label: 'PAN Card', status: 'pending' as const },
];

const DOC_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  verified: { bg: '#E8F5E9', text: '#00C853', label: 'Verified ✓' },
  uploaded: { bg: '#FFF8E1', text: '#FFB300', label: 'Under Review' },
  rejected: { bg: '#FFEBEE', text: '#E53935', label: 'Rejected ✕' },
  pending: { bg: '#F6F8FC', text: '#6B7280', label: 'Not Uploaded' },
};

const REVIEWS = [
  { name: 'Priya S.', rating: 5, text: 'Very punctual and friendly. Car was spotless!', date: '2 days ago' },
  { name: 'Arjun K.', rating: 5, text: 'Great ride! Smooth driving and good music.', date: '5 days ago' },
];

const DELETE_ICON_PATH = 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z';

export function DriverProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useFocusEffect(
    useCallback(() => {
      getVehicles().then(setVehicles);
    }, []),
  );

  const handleDeleteVehicle = (vehicle: Vehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to remove "${vehicle.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteVehicle(vehicle.id);
            setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
          },
        },
      ],
    );
  };

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
            <Pressable onPress={() => navigation.navigate('Settings')} style={s.gearBtn}>
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
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=100&h=100&fit=crop"
              alt="Driver"
              width={72}
              height={72}
              borderRadius={20}
              style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' }}
            />
            <View style={{ flex: 1 }}>
              <View style={s.nameRow}>
                <Text style={s.driverName}>Rajesh Kumar</Text>
                <View style={[s.verifiedBadge, { backgroundColor: c.success }]}>
                  <Text style={s.verifiedText}>⭐ VERIFIED</Text>
                </View>
              </View>
              <Text style={s.sinceText}>Driver since Jan 2022</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Svg key={n} width={14} height={14} viewBox="0 0 24 24">
                    <Path d={STAR_PATH} fill={n <= 4 ? '#FFB300' : 'rgba(255,255,255,0.3)'} />
                  </Svg>
                ))}
                <Text style={s.ratingText}>4.9 (847 rides)</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── My Vehicles ──────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.secHeader}>
            <Text style={[s.secTitle, { color: c.text }]}>My Vehicles</Text>
            <Pressable onPress={() => navigation.navigate('AddVehicle')} style={[s.addBtn, { backgroundColor: c.primaryLight }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>+ Add</Text>
            </Pressable>
          </View>

          {vehicles.length === 0 && (
            <View style={[s.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center' }}>No vehicles added yet.</Text>
              <Text style={{ fontSize: 12, color: c.textDisabled, textAlign: 'center', marginTop: 4 }}>Tap "+ Add" to add your first vehicle.</Text>
            </View>
          )}

          {vehicles.map((vehicle, idx) => {
            const isLatest = idx === vehicles.length - 1;
            const featureChips = [...vehicle.features, `${vehicle.seats} Seats`];
            return (
              <View key={vehicle.id} style={[s.vehicleCard, { backgroundColor: c.surface, borderColor: c.border, marginBottom: idx < vehicles.length - 1 ? 14 : 0 }]}>
                {vehicle.imageUri ? (
                  <Image
                    source={{ uri: vehicle.imageUri }}
                    style={{ width: '100%', height: 140, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[s.vehicleImagePlaceholder, { backgroundColor: c.bg }]}>
                    <Svg width={32} height={32} viewBox="0 0 24 24">
                      <Path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-5h14v5z" fill={c.textSec} />
                    </Svg>
                  </View>
                )}
                <View style={s.vehicleBody}>
                  <View style={s.vehicleTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{vehicle.name}</Text>
                      <Text style={{ fontSize: 13, color: c.textSec }}>{vehicle.color} · {vehicle.regNumber} · {vehicle.modelYear}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {isLatest && (
                        <View style={[s.activeBadge, { backgroundColor: c.successLight }]}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: c.success }}>Active</Text>
                        </View>
                      )}
                      <Pressable onPress={() => handleDeleteVehicle(vehicle)} hitSlop={8} style={[s.deleteBtn, { backgroundColor: c.errorLight }]}>
                        <Svg width={16} height={16} viewBox="0 0 24 24">
                          <Path d={DELETE_ICON_PATH} fill={c.error} />
                        </Svg>
                      </Pressable>
                    </View>
                  </View>
                  <View style={s.featureRow}>
                    {featureChips.map(f => (
                      <View key={f} style={[s.featureChip, { backgroundColor: c.bg, borderColor: c.border }]}>
                        <Text style={{ fontSize: 11, color: c.textSec }}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Document Status ──────────────────────────────── */}
        <View style={s.section}>
          <View style={s.secHeader}>
            <Text style={[s.secTitle, { color: c.text }]}>Document Status</Text>
            <Pressable onPress={() => navigation.navigate('PersonalDetails')}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Manage</Text>
            </Pressable>
          </View>

          <View style={[s.docsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            {DOCS.map((doc, i) => {
              const ds = DOC_COLORS[doc.status];
              return (
                <View key={doc.label}>
                  {i > 0 && <View style={[s.divider, { backgroundColor: c.border }]} />}
                  <View style={s.docRow}>
                    <Text style={{ flex: 1, fontSize: 14, color: c.text }}>{doc.label}</Text>
                    <View style={[s.docStatusBadge, { backgroundColor: ds.bg }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: ds.text }}>{ds.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Recent Reviews ───────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.secTitle, { color: c.text, marginBottom: 12 }]}>Recent Reviews</Text>
          {REVIEWS.map((r, i) => (
            <View key={i} style={[s.reviewCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={s.reviewHeader}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{r.name}</Text>
                <View style={s.starsRowSmall}>
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <Svg key={j} width={12} height={12} viewBox="0 0 24 24">
                      <Path d={STAR_PATH} fill="#FFB300" />
                    </Svg>
                  ))}
                </View>
              </View>
              <Text style={{ fontSize: 13, color: c.textSec }}>{r.text}</Text>
              <Text style={{ fontSize: 11, color: c.textSec, marginTop: 6 }}>{r.date}</Text>
            </View>
          ))}
        </View>

        {/* ── Verified Driver Program ──────────────────────── */}
        <View style={s.section}>
          <LinearGradient
            colors={['#FFB300', '#FF8A50']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.verifiedCard}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>🏆 Apply for Verified Driver</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 20 }}>
              Get a verified badge, 15% more bookings, and priority listing by completing all requirements.
            </Text>
            <Pressable onPress={() => navigation.navigate('KYC')} style={s.applyBtn}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF8A50' }}>Apply Now</Text>
            </Pressable>
          </LinearGradient>
        </View>
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
  verifiedBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 20 },
  verifiedText: { fontSize: 10, fontWeight: '700', color: 'white' },
  sinceText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: 'white', marginLeft: 4 },

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
  featureChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20, borderWidth: 1 },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: 'center' },
  vehicleImagePlaceholder: { width: '100%', height: 140, borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: 'center', justifyContent: 'center' },

  /* Docs */
  docsCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1, marginLeft: 16 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  docStatusBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },

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
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
});
