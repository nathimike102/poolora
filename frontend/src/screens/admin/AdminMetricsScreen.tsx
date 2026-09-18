import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useApp } from '../../context/AppContext';
import { Icon, type IconName } from '../../components/Icon';
import { adminService, SystemMetrics } from '../../services/adminService';

export const AdminMetricsScreen: React.FC = () => {
  const { c } = useApp();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getMetrics();
      setMetrics(data);
    } catch (err) {
      setError('Failed to load metrics. Please try again.');
      console.error('Failed to load metrics', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  };

  if (loading && !metrics) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.text }}>Loading metrics...</Text>
      </View>
    );
  }

  if (error && !metrics) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: '#FF6B6B', marginBottom: 8 }}>{error}</Text>
        <Text onPress={loadMetrics} style={{ color: c.primary || '#4CAF50', fontWeight: 'bold' }}>
          Tap to Retry
        </Text>
      </View>
    );
  }

  if (!metrics) {
    return (
      <View style={[styles.container, { backgroundColor: c.bg }]}> 
        <Text style={{ color: c.text }}>No data available</Text>
      </View>
    );
  }

  const MetricCard = ({
    title,
    value,
    icon,
    color,
  }: {
    title: string;
    value: string | number;
    icon: IconName;
    color: string;
  }) => (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: c.surface,
          borderLeftColor: color,
        },
      ]}
    >
      <Icon name={icon} size={28} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.metricTitle, { color: c.textSec }]}>
          {title}
        </Text>
        <Text style={[styles.metricValue, { color: c.text }]}>{value}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.title, { color: c.text }]}>System metrics</Text>

      {/* Top Row */}
      <View style={styles.row}>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Total Rides"
            value={metrics.totalRides}
            icon="car"
            color="#4CAF50"
          />
        </View>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Active Rides"
            value={metrics.activeRides}
            icon="timer-outline"
            color="#2196F3"
          />
        </View>
      </View>

      {/* Revenue and Rating */}
      <View style={styles.row}>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Daily Revenue"
            value={`₹${metrics.revenue.toLocaleString()}`}
            icon="cash"
            color="#FF9800"
          />
        </View>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Avg Rating"
            value={metrics.avgRating.toFixed(2)}
            icon="star-outline"
            color="#FFD700"
          />
        </View>
      </View>

      {/* Users and Drivers */}
      <View style={styles.row}>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Total Users"
            value={metrics.totalUsers}
            icon="account-group"
            color="#2B6CC4"
          />
        </View>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Active Drivers"
            value={metrics.activeDrivers}
            icon="steering"
            color="#00BCD4"
          />
        </View>
      </View>

      {/* Completed and Riders */}
      <View style={styles.row}>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Completed Today"
            value={metrics.completedToday}
            icon="check-circle-outline"
            color="#4CAF50"
          />
        </View>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Active Riders"
            value={metrics.activeRiders}
            icon="account"
            color="#0B2447"
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  columnHalf: {
    flex: 1,
  },
  metricCard: {
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
  },
  metricIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  metricTitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});