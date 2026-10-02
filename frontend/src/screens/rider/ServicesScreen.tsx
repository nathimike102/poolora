/**
 * screens/rider/ServicesScreen.tsx
 *
 * Everything a rider can do, as a grid: each kind of ride, scheduling,
 * saved routes, safety, and driving with Poolora. Services that aren't built
 * yet are listed separately as coming soon rather than as working buttons.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { Icon, type IconName } from '../../components/Icon';
import { Typography, Spacing, Radius } from '../../theme';
import type { RootStackParamList, RiderTabParamList } from '../../navigation/types';
import { VEHICLE_CATEGORIES, type VehicleCategory } from '../../utils/vehicles';
import { useTranslation } from 'react-i18next';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RiderTabParamList, 'Services'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Service {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

export function ServicesScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();
  const { c, switchRole } = useApp();
  const insets = useSafeAreaInsets();

  const rides: Service[] = (Object.keys(VEHICLE_CATEGORIES) as VehicleCategory[]).map(key => ({
    key,
    label: VEHICLE_CATEGORIES[key].label,
    icon: VEHICLE_CATEGORIES[key].icon,
    onPress: () => navigation.navigate('Search', { category: key }),
  }));

  const more: Service[] = [
    { key: 'later', label: t('services.later'), icon: 'calendar-clock', onPress: () => navigation.navigate('Search', { schedule: true }) },
    { key: 'routes', label: t('services.routes'), icon: 'map-marker-path', onPress: () => navigation.navigate('AddSavedRoute') },
    { key: 'sos', label: t('services.sos'), icon: 'shield-check-outline', onPress: () => navigation.navigate('SOS') },
    { key: 'contacts', label: t('services.contacts'), icon: 'account-heart-outline', onPress: () => navigation.navigate('EmergencyContacts') },
    { key: 'messages', label: t('services.messages'), icon: 'message-text-outline', onPress: () => navigation.navigate('Messages') },
    { key: 'parcels', label: t('services.parcels'), icon: 'package-variant-closed', onPress: () => navigation.navigate('ShipParcel') },
    { key: 'trips', label: t('services.trips'), icon: 'bag-suitcase-outline', onPress: () => navigation.navigate('TripPartners') },
    { key: 'drive', label: t('services.drive'), icon: 'steering', onPress: switchRole },
  ];


  return (
    <View style={[styles.root, { backgroundColor: c.surface, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{t('services.allServices')}</Text>

        <Text style={[styles.section, { color: c.textSec }]}>{t('services.rides')}</Text>
        <Grid items={rides} />

        <Text style={[styles.section, { color: c.textSec }]}>{t('services.more')}</Text>
        <Grid items={more} />
      </ScrollView>
    </View>
  );
}

function Grid({ items }: { items: Service[] }) {
  const { c } = useApp();
  return (
    <View style={styles.grid}>
      {items.map(s => (
        <Pressable
          key={s.key}
          onPress={s.onPress}
          accessibilityRole="button"
          accessibilityLabel={s.label}
          style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.tile, { backgroundColor: c.surfaceVariant }]}>
            <Icon name={s.icon} size={34} color={c.primary} />
          </View>
          <Text style={[styles.label, { color: c.text }]} numberOfLines={1}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'] },
  title: { fontSize: Typography['6xl'], fontWeight: Typography.extrabold, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  section: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.xl, marginHorizontal: -Spacing.xs - 2 },
  cell: { width: '33.333%', paddingHorizontal: Spacing.xs + 2, alignItems: 'center', gap: Spacing.sm },
  tile: { width: '100%', aspectRatio: 1.25, borderRadius: Radius['2xl'], alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: Typography.lg, fontWeight: Typography.semibold },
});
