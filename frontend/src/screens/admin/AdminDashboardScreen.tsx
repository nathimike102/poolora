import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';

interface AdminMenuItem {
  icon: string;
  title: string;
  description: string;
  route: string;
  color: string;
}

export const AdminDashboardScreen: React.FC = () => {
  const { c } = useApp();
  const navigation = useNavigation();

  const menuItems: AdminMenuItem[] = [
    {
      icon: '🚨',
      title: 'Safety Incidents',
      description: 'View and manage SOS incidents',
      route: 'AdminIncidents',
      color: '#FF6B6B',
    },
    {
      icon: '📊',
      title: 'System Metrics',
      description: 'View system performance & analytics',
      route: 'AdminMetrics',
      color: '#4CAF50',
    },
    {
      icon: '👥',
      title: 'User Management',
      description: 'Manage users, KYC, and bans',
      route: 'AdminUsers',
      color: '#2196F3',
    },
    {
      icon: '🚗',
      title: 'Ride Management',
      description: 'Monitor and manage rides',
      route: 'AdminRides',
      color: '#FF9800',
    },
    {
      icon: '💳',
      title: 'Payment Management',
      description: 'Manage payments and settlements',
      route: 'AdminPayments',
      color: '#9C27B0',
    },
    {
      icon: '⚙️',
      title: 'System Settings',
      description: 'Configure app settings',
      route: 'AdminSettings',
      color: '#607D8B',
    },
  ];

  const MenuItem = ({ item }: { item: AdminMenuItem }) => (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: c.surface }]}
      onPress={() => navigation.navigate(item.route as never)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: item.color + '20',
          },
        ]}
      >
        <Text style={styles.icon}>{item.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemTitle, { color: c.text }]}>
          {item.title}
        </Text>
        <Text style={[styles.itemDescription, { color: c.textSec }]}>
          {item.description}
        </Text>
      </View>
      <Text style={{ fontSize: 18 }}>→</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
    >
      <Text style={[styles.title, { color: c.text }]}>
        👨‍💼 Admin Dashboard
      </Text>
      <Text style={[styles.subtitle, { color: c.textSec }]}>
        Manage system, incidents, and operations
      </Text>

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <MenuItem key={index} item={item} />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  menuContainer: {
    gap: 12,
    marginBottom: 20,
  },
  menuItem: {
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 12,
    marginTop: 2,
  },
});