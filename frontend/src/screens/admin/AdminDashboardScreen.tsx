import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../../context/AppContext';
import { Icon, type IconName } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';

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
  const { c } = useApp();
  const navigation = useNavigation<Nav>();

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.subtitle, { color: c.textSec }]}>
        Admin tools. Every action here is recorded against your account.
      </Text>
      {MENU.map(item => (
        <Pressable
          key={item.route}
          onPress={() => navigation.navigate(item.route)}
          accessibilityRole="button"
          style={[styles.menuItem, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <View style={[styles.iconContainer, { backgroundColor: c.primaryLight }]}>
            <Icon name={item.icon} size={24} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, { color: c.text }]}>{item.title}</Text>
            <Text style={[styles.itemDescription, { color: c.textSec }]}>{item.description}</Text>
          </View>
          <Icon name="chevron-right" size={22} color={c.textSec} />
        </Pressable>
      ))}
    </ScrollView>
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
