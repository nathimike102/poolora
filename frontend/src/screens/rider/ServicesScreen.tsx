/**
 * screens/rider/ServicesScreen.tsx
 *
 * Everything a rider can do, as grids of 3D tiles in the style of Uber's
 * Services tab: each kind of ride and ways to travel, sending a parcel, and
 * the rider's own Siham (work, wallet, impact, receipts, safety).
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../components/Text';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { ServiceTile, TileGrid } from '../../components/ServiceTile';
import type { Icon3DName } from '../../components/Icon3D';
import { ScreenGlow } from '../../components/ScreenGlow';
import { Typography, Spacing } from '../../theme';
import type { RootStackParamList, RiderTabParamList } from '../../navigation/types';
import { VEHICLE_CATEGORIES, type VehicleCategory } from '../../utils/vehicles';
import { useTranslation } from 'react-i18next';

import { tc } from '../../theme/themed';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RiderTabParamList, 'Services'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Service {
  key: string;
  label: string;
  icon: Icon3DName;
  onPress: () => void;
}

export function ServicesScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();
  const {
    switchRole
  } = useApp();
  const insets = useSafeAreaInsets();

  const rides: Service[] = [
    ...(Object.keys(VEHICLE_CATEGORIES) as VehicleCategory[]).map(key => ({
      key,
      label: VEHICLE_CATEGORIES[key].label,
      icon: VEHICLE_CATEGORIES[key].icon3d,
      onPress: () => navigation.navigate('Search', { category: key }),
    })),
    { key: 'later', label: t('services.later'), icon: 'spiralCalendar', onPress: () => navigation.navigate('Search', { schedule: true }) },
    { key: 'trips', label: t('services.trips'), icon: 'handshake', onPress: () => navigation.navigate('TripPartners') },
    { key: 'routes', label: t('services.routes'), icon: 'worldMap', onPress: () => navigation.navigate('AddSavedRoute') },
  ];

  const send: Service[] = [
    { key: 'parcels', label: t('services.parcels'), icon: 'package', onPress: () => navigation.navigate('ShipParcel') },
  ];

  const yours: Service[] = [
    { key: 'work', label: t('services.work'), icon: 'briefcase', onPress: () => navigation.navigate('Work') },
    { key: 'wallet', label: t('services.wallet'), icon: 'purse', onPress: () => navigation.navigate('Wallet') },
    { key: 'impact', label: t('services.impact'), icon: 'herb', onPress: () => navigation.navigate('Impact') },
    { key: 'receipts', label: t('services.receipts'), icon: 'receipt', onPress: () => navigation.navigate('Receipts') },
    { key: 'sos', label: t('services.sos'), icon: 'shield', onPress: () => navigation.navigate('SOS') },
    { key: 'contacts', label: t('services.contacts'), icon: 'telephoneReceiver', onPress: () => navigation.navigate('EmergencyContacts') },
    { key: 'messages', label: t('services.messages'), icon: 'speechBalloon', onPress: () => navigation.navigate('Messages') },
    { key: 'drive', label: t('services.drive'), icon: 'moneyBag', onPress: switchRole },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenGlow />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, tc.color_text]} accessibilityRole="header">{t('services.allServices')}</Text>

        <Text style={[styles.section, tc.color_text]}>{t('services.goAnywhere')}</Text>
        <Grid items={rides} />

        <Text style={[styles.section, tc.color_text]}>{t('services.sendSomething')}</Text>
        <Grid items={send} />

        <Text style={[styles.section, tc.color_text]}>{t('services.yourSiham')}</Text>
        <Grid items={yours} />
      </ScrollView>
    </View>
  );
}

function Grid({ items }: { items: Service[] }) {
  return (
    <TileGrid>
      {items.map(s => (
        <ServiceTile key={s.key} icon={s.icon} label={s.label} onPress={s.onPress} />
      ))}
    </TileGrid>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'] },
  title: { fontSize: Typography['6xl'], fontWeight: Typography.extrabold, marginTop: Spacing.lg },
  section: { fontSize: Typography['2xl'], fontWeight: Typography.bold, marginTop: Spacing['2xl'], marginBottom: Spacing.sm },
});
