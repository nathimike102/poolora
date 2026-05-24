/**
 * screens/rider/RiderHomeScreen.tsx
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle as SvgCircle, Path } from 'react-native-svg';
import { useNavigation, useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Text, IconButton, Button, Chip } from 'react-native-paper';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleToggle } from '../../components/RoleToggle';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList, RiderTabParamList } from '../../navigation/types';
import { getSavedRoutes, deleteSavedRoute, type SavedRoute } from '../../services/savedRouteService';
import { rideService } from '../../services';
import { logger } from '../../utils/logger';
import type { Ride } from '../../types/api';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RiderTabParamList, 'RiderHome'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Quick Actions Config ──────────────────────────────────────────────────────

const quickActions = [
  { icon: '🚗', label: 'Find Ride', route: 'Search' as const, color: '#EDE9FE', textColor: '#7C3AED' },
  { icon: '📦', label: 'Parcel', route: 'ShipParcel' as const, color: '#FFF3EE', textColor: '#FF8A50' },
  { icon: '🗺️', label: 'Trip Pool', route: 'PlanTrip' as const, color: '#E8F5E9', textColor: '#00C853' },
  { icon: '⚡', label: 'Instant', route: 'Search' as const, color: '#FFF8E1', textColor: '#FFB300' },
];

// ─── Default Routes Config ────────────────────────────────────────────────────

const defaultRoutes = [
  { icon: '🏠', from: 'Home', to: 'Office', time: '45 min', saves: '₹200' },
  { icon: '🏋️', from: 'Home', to: 'Gym', time: '20 min', saves: '₹100' },
];

// ─── AnimatedPressable ────────────────────────────────────────────────────────
// Replaces motion.button whileTap={{ scale: N }}

function AnimatedPressable({
  onPress,
  scaleValue = 0.95,
  style,
  children,
}: {
  onPress: () => void;
  scaleValue?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [scale, scaleValue]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function RiderHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [upcomingRides, setUpcomingRides] = useState<Ride[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [ridesError, setRidesError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSavedRoutes().then(setSavedRoutes).catch(() => {});
    }, []),
  );

  // Fetch upcoming rides on focus
  useFocusEffect(
    useCallback(() => {
      const fetchRides = async () => {
        setLoadingRides(true);
        setRidesError(null);
        try {
          const rides = await rideService.getUpcomingRides();
          setUpcomingRides(rides);
        } catch (error) {
          logger.error('Failed to fetch upcoming rides', { error });
          setRidesError(error instanceof Error ? error.message : 'Failed to load rides');
          setUpcomingRides([]);
        } finally {
          setLoadingRides(false);
        }
      };

      fetchRides();
    }, []),
  );

  const handleDeleteRoute = (route: SavedRoute) => {
    Alert.alert(
      'Delete Route',
      `Remove "${route.name}" from saved routes?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSavedRoute(route.id);
            setSavedRoutes(prev => prev.filter(r => r.id !== route.id));
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style="light" />
      {/* Scrollable content */}
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Gradient Header ─────────────────────────────────────────── */}
        <LinearGradient
          colors={[c.primary, c.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            {/* Left: Greeting + Name */}
            <View>
              <Text variant="bodyMedium" style={styles.greetingText}>{greeting} 🌞</Text>
              <Text variant="headlineSmall" style={styles.nameText}>Priya Sharma</Text>
            </View>

            {/* Right: Bell */}
            <View style={styles.headerRight}>
              {/* Bell Button */}
              <View style={styles.bellWrap}>
                <IconButton
                  icon="bell"
                  iconColor="white"
                  size={20}
                  onPress={() => navigation.navigate('Notifications')}
                  style={styles.bellButton}
                />
                {/* Notification dot */}
                <View style={[styles.notifDot, { backgroundColor: c.accent }]} />
              </View>
            </View>
          </View>

          {/* Row 2: Role Toggle */}
          <RoleToggle />
        </LinearGradient>

        {/* ── Quick Actions ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.quickActionsRow}>
            {quickActions.map((item) => (
              <AnimatedPressable
                key={item.label}
                scaleValue={0.93}
                onPress={() => navigation.navigate(item.route)}
                style={[styles.quickActionCard, { backgroundColor: item.color }]}
              >
                <Text style={styles.quickActionIcon}>{item.icon}</Text>
                <Text variant="labelSmall" style={[styles.quickActionLabel, { color: item.textColor }]}>{item.label}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>

        {/* ── Upcoming Rides ──────────────────────────────────────────── */}
        <View style={styles.section}>
          {loadingRides ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text variant="bodySmall" style={[styles.loadingText, { color: c.textSec }]}>Loading rides...</Text>
            </View>
          ) : ridesError ? (
            <View style={[styles.errorContainer, { backgroundColor: c.errorLight, borderColor: c.error }]}>
              <Text variant="bodyMedium" style={[styles.errorText, { color: c.error }]}>{ridesError}</Text>
              <Button mode="outlined" compact onPress={() => {
                setLoadingRides(true);
                rideService.getUpcomingRides()
                  .then(setUpcomingRides)
                  .catch(err => setRidesError(err.message || 'Failed to load rides'))
                  .finally(() => setLoadingRides(false));
              }} style={{ marginTop: Spacing.sm }}>
                Retry
              </Button>
            </View>
          ) : upcomingRides.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: c.text }]}>Upcoming Rides</Text>
                <Button mode="text" compact onPress={() => navigation.navigate('MyRides' as any)} labelStyle={{ color: c.primary }}>
                  See all
                </Button>
              </View>

              {/* Horizontal scroll replaces overflow-x-auto */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ridesScrollContent}
              >
                {upcomingRides.map((ride) => (
                  <AnimatedPressable
                    key={ride._id}
                    scaleValue={0.97}
                    onPress={() => navigation.navigate('RideDetail', { rideId: ride._id })}
                    style={[
                      styles.rideCard,
                      {
                        backgroundColor: c.surface,
                        borderColor: c.border,
                        ...Shadow.sm,
                      },
                    ]}
                  >
                    {/* Status + Price */}
                    <View style={styles.rideCardTopRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                              backgroundColor: ride.status === 'active' ? c.successLight : c.warningLight,
                            },
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={[
                              styles.statusText,
                              { color: ride.status === 'active' ? c.success : c.warning },
                            ]}
                          >
                            {ride.status === 'active' ? '● ACTIVE' : '● DRAFT'}
                          </Text>
                        </View>
                        <Text variant="titleMedium" style={[styles.ridePrice, { color: c.primary }]}>₹{ride.totalPrice || 0}</Text>
                      </View>

                      {/* Route */}
                      <View style={styles.routeColumn}>
                        <View style={styles.routeRow}>
                          <View style={[styles.routeDotFrom, { backgroundColor: c.primary }]} />
                          <Text variant="bodyMedium" style={[styles.routeText, { color: c.text }]}>{ride.pickupLocation?.address || 'Pickup'}</Text>
                        </View>
                        <View style={[styles.routeLine, { backgroundColor: c.border }]} />
                        <View style={styles.routeRow}>
                          <View style={[styles.routeDotTo, { backgroundColor: c.error }]} />
                          <Text variant="bodyMedium" style={[styles.routeText, { color: c.text }]}>{ride.dropoffLocation?.address || 'Dropoff'}</Text>
                        </View>
                      </View>

                      {/* Date */}
                      <View style={styles.rideDateRow}>
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill={c.textSec}>
                          <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                        </Svg>
                        <Text variant="bodySmall" style={[styles.rideDateText, { color: c.textSec }]}>
                          {new Date(ride.scheduledDeparture || ride.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                  </AnimatedPressable>
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill={c.textSec} opacity={0.5}>
                <Path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
              </Svg>
              <Text variant="bodyMedium" style={[styles.emptyText, { color: c.textSec }]}>No upcoming rides</Text>
              <Button mode="contained" onPress={() => navigation.navigate('Search')} style={{ marginTop: Spacing.lg }}>
                Find a Ride
              </Button>
            </View>
          )}
        </View>

        {/* ── Saved Routes ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={[styles.sectionTitle, { color: c.text }]}>Saved Routes</Text>
              <Button mode="text" compact onPress={() => navigation.navigate('AddSavedRoute')} labelStyle={{ color: c.primary }}>
                + Add
              </Button>
          </View>

          <View style={styles.routesColumn}>
            {/* Default routes */}
            {defaultRoutes.map((route, i) => (
              <AnimatedPressable
                key={`default-${i}`}
                scaleValue={0.98}
                onPress={() => navigation.navigate('RideResults')}
                style={[
                  styles.routeCard,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    ...Shadow.sm,
                  },
                ]}
              >
                <View style={[styles.routeIconWrap, { backgroundColor: c.bg }]}>
                  <Text style={styles.routeEmoji}>{route.icon}</Text>
                </View>
                <View style={styles.flex1}>
                  <Text variant="bodyMedium" style={[styles.routeCardTitle, { color: c.text }]}>
                    {route.from} → {route.to}
                  </Text>
                  <Text variant="bodySmall" style={[styles.routeCardSub, { color: c.textSec }]}>
                    ~{route.time} · Save {route.saves}
                  </Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill={c.textSec}>
                  <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                </Svg>
              </AnimatedPressable>
            ))}

            {/* User-saved routes */}
            {savedRoutes.map(route => (
              <AnimatedPressable
                key={route.id}
                scaleValue={0.98}
                onPress={() => navigation.navigate('RideResults')}
                style={[
                  styles.routeCard,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    ...Shadow.sm,
                  },
                ]}
              >
                <View style={[styles.routeIconWrap, { backgroundColor: c.bg }]}>
                  <Text style={styles.routeEmoji}>{route.icon}</Text>
                </View>
                <View style={styles.flex1}>
                  <Text variant="bodyMedium" style={[styles.routeCardTitle, { color: c.text }]}>
                    {route.name}
                  </Text>
                  <Text variant="bodySmall" style={[styles.routeCardSub, { color: c.textSec }]}>
                    {route.time ? `~${route.time}` : ''}{route.time && route.savings ? ' · ' : ''}{route.savings ? `Save ${route.savings}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteRoute(route)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.deleteBtn}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill={c.error}>
                    <Path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </Svg>
                </TouchableOpacity>
              </AnimatedPressable>
            ))}
          </View>
        </View>

        {/* ── Ship a Parcel Banner ────────────────────────────────────── */}
        <View style={styles.bannerSection}>
          <AnimatedPressable
            scaleValue={0.98}
            onPress={() => navigation.navigate('ShipParcel')}
            style={styles.bannerWrap}
          >
            <LinearGradient
              colors={['#FF8A50', '#FF6B35']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerGradient}
            >
              <Text style={styles.bannerEmoji}>📦</Text>
              <View style={styles.flex1}>
                <Text variant="titleMedium" style={styles.bannerTitle}>Ship a Parcel</Text>
                <Text variant="bodySmall" style={styles.bannerSub}>Send packages via verified drivers</Text>
              </View>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
              </Svg>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  greetingText: {
    color: 'rgba(255,255,255,0.65)',
  },
  nameText: {
    fontWeight: Typography.extrabold,
    color: 'white',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },

  // ── Bell ───────────────────────────────────────────────────────
  bellWrap: {
    position: 'relative',
  },
  bellButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    margin: 0,
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.8)',
  },

  // ── Section Layout ─────────────────────────────────────────────
  section: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontWeight: Typography.bold,
  },
  seeAllText: {
    fontWeight: Typography.semibold,
  },

  // ── Quick Actions ──────────────────────────────────────────────
 quickActionsRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
  quickActionWrapper: {
    flex: 1,
  },
  quickActionCard: {
  flex: 1,
  height: 85,
  width:85,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: Radius.lg,
},
  quickActionIcon: {
    fontSize: 24,
    lineHeight: 24,
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: Typography.semibold,
    textAlign: 'center',
    lineHeight: 12,
    maxWidth: '100%',
  },

  // ── Ride Cards (horizontal scroll) ─────────────────────────────
  ridesScrollContent: {
    gap: Spacing.md,
  },
  rideCard: {
    width: 220,
    borderRadius: Radius.xl,
    padding: Spacing.lg - 2, // 14dp
    borderWidth: 1,
  },
  rideCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: {
    fontWeight: Typography.bold,
  },
  ridePrice: {
    fontWeight: Typography.bold,
  },
  routeColumn: {
    gap: 0,
    marginBottom: Spacing.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  routeDotFrom: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  routeDotTo: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  routeLine: {
    width: 1,
    height: 8,
    marginLeft: 3.5,
  },
  routeText: {
    fontWeight: Typography.semibold,
  },
  rideDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rideDateText: {},

  // ── Saved Route Cards ──────────────────────────────────────────
  routesColumn: {
    gap: 10,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.md + 2, // 14dp
    borderWidth: 1,
  },
  routeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeEmoji: {
    fontSize: 22,
  },
  routeCardTitle: {
    fontWeight: Typography.semibold,
  },
  routeCardSub: {
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: Radius.sm,
  },

  // ── Parcel Banner ──────────────────────────────────────────────
  bannerSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  bannerWrap: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
  },
  bannerEmoji: {
    fontSize: 36,
  },
  bannerTitle: {
    fontWeight: Typography.bold,
    color: 'white',
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.8)',
  },

  // ── Loading / Error / Empty States ─────────────────────────────
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  errorContainer: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginHorizontal: Spacing.lg,
  },
  errorText: {
    fontWeight: Typography.semibold,
  },
  emptyContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  emptyText: {
    marginTop: Spacing.md,
  },
});
