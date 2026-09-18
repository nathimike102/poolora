/**
 * screens/rider/RiderHomeScreen.tsx
 */

import React, { useState, useRef, useCallback } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Text, IconButton, Button } from 'react-native-paper';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleToggle } from '../../components/RoleToggle';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList, RiderTabParamList } from '../../navigation/types';
import { getSavedRoutes, deleteSavedRoute, type SavedRoute } from '../../services/savedRouteService';
import { rideService } from '../../services';
import { logger } from '../../utils/logger';
import type { UpcomingBooking } from '../../types/api';
import { Icon } from '../../components/Icon';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RiderTabParamList, 'RiderHome'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Quick Actions Config ──────────────────────────────────────────────────────

const quickActions = [
  { icon: 'car' as const, label: 'Find a ride', route: 'Search' as const },
  { icon: 'car-clock' as const, label: 'My rides', route: 'MyRides' as const },
  { icon: 'shield-alert' as const, label: 'Safety', route: 'SOS' as const },
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
    <TouchableOpacity accessibilityRole="button"
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
  const { c, user } = useApp();
  const insets = useSafeAreaInsets();

  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [upcomingRides, setUpcomingRides] = useState<UpcomingBooking[]>([]);
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
          setRidesError('Your upcoming rides could not be loaded.');
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
              <Text variant="bodyMedium" style={styles.greetingText}>{greeting}</Text>
              {user?.name ? (
                <Text variant="headlineSmall" style={styles.nameText}>{user.name}</Text>
              ) : null}
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
                  accessibilityLabel="Notifications"
                  style={styles.bellButton}
                />
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
                onPress={() => navigation.navigate(item.route as never)}
                style={[styles.quickActionCard, { backgroundColor: c.primaryLight }]}
              >
                <Icon name={item.icon} size={28} color={c.primary} />
                <Text variant="labelSmall" style={[styles.quickActionLabel, { color: c.primaryDark }]}>{item.label}</Text>
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
                setRidesError(null);
                rideService.getUpcomingRides()
                  .then(setUpcomingRides)
                  .catch(() => setRidesError('Your upcoming rides could not be loaded.'))
                  .finally(() => setLoadingRides(false));
              }} style={{ marginTop: Spacing.sm }}>
                Retry
              </Button>
            </View>
          ) : upcomingRides.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: c.text }]}>Upcoming Rides</Text>
                <Button mode="text" compact onPress={() => navigation.navigate('MyRides')} labelStyle={{ color: c.primary }}>
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
                    key={ride.bookingId}
                    scaleValue={0.97}
                    onPress={() => navigation.navigate('ActiveRide', { rideId: ride.rideId, bookingId: ride.bookingId })}
                    style={[styles.rideCard, { backgroundColor: c.surface, borderColor: c.border, ...Shadow.sm }]}
                  >
                    <View style={styles.rideCardTopRow}>
                      <View style={[styles.statusBadge, { backgroundColor: ride.status === 'confirmed' ? c.successLight : c.warningLight }]}>
                        <Text variant="labelSmall" style={[styles.statusText, { color: ride.status === 'confirmed' ? c.successDark : '#8A5A00' }]}>
                          {ride.status === 'confirmed' ? 'Confirmed' : 'Waiting for driver'}
                        </Text>
                      </View>
                      <Text variant="titleMedium" style={[styles.ridePrice, { color: c.primary }]}>₹{ride.pricePerSeat}</Text>
                    </View>

                    <View style={styles.routeColumn}>
                      <View style={styles.routeRow}>
                        <View style={[styles.routeDotFrom, { backgroundColor: c.primary }]} />
                        <Text variant="bodyMedium" style={[styles.routeText, { color: c.text }]} numberOfLines={1}>{ride.from}</Text>
                      </View>
                      <View style={[styles.routeLine, { backgroundColor: c.border }]} />
                      <View style={styles.routeRow}>
                        <View style={[styles.routeDotTo, { backgroundColor: c.error }]} />
                        <Text variant="bodyMedium" style={[styles.routeText, { color: c.text }]} numberOfLines={1}>{ride.to}</Text>
                      </View>
                    </View>

                    <View style={styles.rideDateRow}>
                      <Icon name="clock-outline" size={12} color={c.textSec} />
                      <Text variant="bodySmall" style={[styles.rideDateText, { color: c.textSec }]}>
                        {new Date(ride.departureTime).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })} with {ride.driverName}
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
            {savedRoutes.length === 0 && (
              <Text variant="bodySmall" style={{ color: c.textSec }}>
                Save routes you travel often to search them in one tap.
              </Text>
            )}
            {savedRoutes.map(route => (
              <AnimatedPressable
                key={route.id}
                scaleValue={0.98}
                onPress={() => navigation.navigate('Search', { from: route.from, to: route.to })}
                style={[styles.routeCard, { backgroundColor: c.surface, borderColor: c.border, ...Shadow.sm }]}
              >
                <View style={[styles.routeIconWrap, { backgroundColor: c.bg }]}>
                  <Icon name={route.icon} size={20} color={c.primary} />
                </View>
                <View style={styles.flex1}>
                  <Text variant="bodyMedium" style={[styles.routeCardTitle, { color: c.text }]}>{route.name}</Text>
                  <Text variant="bodySmall" style={[styles.routeCardSub, { color: c.textSec }]} numberOfLines={1}>
                    {route.from} to {route.to}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteRoute(route)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete saved route ${route.name}`}
                  style={styles.deleteBtn}
                >
                  <Icon name="delete-outline" size={18} color={c.error} />
                </TouchableOpacity>
              </AnimatedPressable>
            ))}
          </View>
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
    borderColor: 'rgba(11,122,117,0.8)',
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
    borderRadius: 8,
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
