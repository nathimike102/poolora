import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from '../../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Icon, type IconName } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { tc, tk } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface AdminMenuItem {
  icon: IconName;
  title: string;
  description: string;
  route: 'AdminIncidents' | 'AdminMetrics' | 'AdminVerifications';
}

const MENU: AdminMenuItem[] = [
  { icon: 'alert', title: 'Safety incidents', description: 'Active SOS alerts and escalations', route: 'AdminIncidents' },
  { icon: 'card-account-details-outline', title: 'Driver verifications', description: 'Review submitted driver documents', route: 'AdminVerifications' },
  { icon: 'chart-line', title: 'System metrics', description: 'Rides, users and payments', route: 'AdminMetrics' },
];

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[{ flex: 1, paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title="Admin" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.subtitle, tc.color_textSec]}>
          Admin tools. Every action here is recorded against your account.
        </Text>
        {MENU.map(item => (
          <Pressable
            key={item.route}
            onPress={() => navigation.navigate(item.route)}
            accessibilityRole="button"
            style={[
              styles.menuItem,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}
          >
            <View style={[styles.iconContainer, tc.backgroundColor_primaryLight]}>
              <Icon name={item.icon} size={24} color={tk.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, tc.color_text]}>{item.title}</Text>
              <Text style={[styles.itemDescription, tc.color_textSec]}>{item.description}</Text>
            </View>
            <Icon name="chevron-right" size={22} color={tk.textSec} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  subtitle: { fontSize: 14, marginBottom: 8 },
  menuItem: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72 },
  iconContainer: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  itemDescription: { fontSize: 13, marginTop: 2 },
});
