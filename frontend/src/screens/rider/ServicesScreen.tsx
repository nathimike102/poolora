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
  const { c, switchRole } = useApp();
  const insets = useSafeAreaInsets();

  const rides: Service[] = (Object.keys(VEHICLE_CATEGORIES) as VehicleCategory[]).map(key => ({
    key,
    label: VEHICLE_CATEGORIES[key].label,
    icon: VEHICLE_CATEGORIES[key].icon,
    onPress: () => navigation.navigate('Search', { category: key }),
  }));

  const more: Service[] = [
    { key: 'later', label: 'Schedule', icon: 'calendar-clock', onPress: () => navigation.navigate('Search', { schedule: true }) },
    { key: 'routes', label: 'Saved routes', icon: 'map-marker-path', onPress: () => navigation.navigate('AddSavedRoute') },
    { key: 'sos', label: 'Safety', icon: 'shield-check-outline', onPress: () => navigation.navigate('SOS') },
    { key: 'contacts', label: 'SOS contacts', icon: 'account-heart-outline', onPress: () => navigation.navigate('EmergencyContacts') },
    { key: 'messages', label: 'Messages', icon: 'message-text-outline', onPress: () => navigation.navigate('Messages') },
    { key: 'drive', label: 'Drive & earn', icon: 'steering', onPress: switchRole },
  ];

  const soon: { label: string; icon: IconName }[] = [
    { label: 'Parcels', icon: 'package-variant-closed' },
    { label: 'Trip planner', icon: 'bag-suitcase-outline' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.surface, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">All services</Text>

        <Text style={[styles.section, { color: c.textSec }]}>Rides</Text>
        <Grid items={rides} />

        <Text style={[styles.section, { color: c.textSec }]}>More</Text>
        <Grid items={more} />

        <Text style={[styles.section, { color: c.textSec }]}>Coming soon</Text>
        <View style={styles.grid}>
          {soon.map(s => (
            <View key={s.label} style={styles.cell} accessible accessibilityLabel={`${s.label}, coming soon`}>
              <View style={[styles.tile, { backgroundColor: c.surfaceVariant, opacity: 0.55 }]}>
                <Icon name={s.icon} size={34} color={c.textSec} />
              </View>
              <Text style={[styles.label, { color: c.textSec }]} numberOfLines={1}>{s.label}</Text>
            </View>
          ))}
        </View>
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
