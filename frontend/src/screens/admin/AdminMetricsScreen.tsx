import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { useApp } from '../../context/AppContext';

export interface RideMetric {
  totalRides: number;
  activeRides: number;
  completedToday: number;
  revenue: number;
  avgRating: number;
  totalUsers: number;
  activeDrivers: number;
  activeRiders: number;
}

export const AdminMetricsScreen: React.FC = () => {
  const { c } = useApp();
  const [metrics, setMetrics] = useState<RideMetric | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      // Fetch system metrics from backend
      const response = await fetch('/api/v1/admin/metrics');
      const data = await response.json();
      setMetrics(data.metrics);
    } catch (error) {
      console.error('Failed to load metrics', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  };

  if (!metrics) {
    return (
      <View style={[styles.container, { backgroundColor: c.bg }]}> 
        <Text style={{ color: c.text }}>Loading...</Text>
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
    icon: string;
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
      <Text style={styles.metricIcon}>{icon}</Text>
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
      <Text style={[styles.title, { color: c.text }]}>📊 System Metrics</Text>

      {/* Top Row */}
      <View style={styles.row}>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Total Rides"
            value={metrics.totalRides}
            icon="🚗"
            color="#4CAF50"
          />
        </View>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Active Rides"
            value={metrics.activeRides}
            icon="⏱️"
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
            icon="💰"
            color="#FF9800"
          />
        </View>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Avg Rating"
            value={metrics.avgRating.toFixed(2)}
            icon="⭐"
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
            icon="👥"
            color="#9C27B0"
          />
        </View>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Active Drivers"
            value={metrics.activeDrivers}
            icon="🚕"
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
            icon="✅"
            color="#4CAF50"
          />
        </View>
        <View style={styles.columnHalf}>
          <MetricCard
            title="Active Riders"
            value={metrics.activeRiders}
            icon="🧑‍💻"
            color="#3F51B5"
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