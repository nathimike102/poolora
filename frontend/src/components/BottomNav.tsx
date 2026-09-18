/**
 * components/BottomNav.tsx
 *
 * Standalone bottom tab bar with animated active indicator.
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../context/AppContext';
import { Typography } from '../theme';
import type { DriverTabParamList, RiderTabParamList, RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'home' | 'search' | 'rides' | 'chat' | 'earnings' | 'profile';
type RouteName = keyof RiderTabParamList | keyof DriverTabParamList | 'Earnings';

interface NavItem {
  tab: Tab;
  label: string;
  route: RouteName;
  hasNotification?: boolean;
  icon: (active: boolean, color: string) => React.ReactElement;
}

// ─── SVG Icon Components ───────────────────────────────────────────────────────

const HomeIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill={active ? color : 'none'}
    stroke={active ? color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SearchIcon = (_active: boolean, _color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill="none"
    stroke={_active ? _color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Circle cx={11} cy={11} r={8} strokeLinecap="round" />
    <Path d="m21 21-4.35-4.35" strokeLinecap="round" />
  </Svg>
);

const RidesIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill={active ? color : 'none'}
    stroke={active ? color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Rect x={3} y={4} width={18} height={18} rx={2} strokeLinecap="round" />
    <Path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
  </Svg>
);

const ChatIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill={active ? color : 'none'}
    stroke={active ? color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ProfileIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill={active ? color : 'none'}
    stroke={active ? color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
    <Circle cx={12} cy={7} r={4} />
  </Svg>
);

const DriverRidesIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill={active ? color : 'none'}
    stroke={active ? color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Path d="M9 17H5a2 2 0 00-2 2v1h18v-1a2 2 0 00-2-2h-4M12 3a4 4 0 00-4 4v4a4 4 0 004 4 4 4 0 004-4V7a4 4 0 00-4-4z"
      strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const EarningsIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill={active ? color : 'none'}
    stroke={active ? color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Line x1={12} y1={1} x2={12} y2={23} strokeLinecap="round" />
    <Path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" />
  </Svg>
);

// ─── Tab data ─────────────────────────────────────────────────────────────────

const riderTabs: NavItem[] = [
  { tab: 'home',    label: 'Home',     route: 'RiderHome', icon: HomeIcon },
  { tab: 'search',  label: 'Search',   route: 'Search',    icon: SearchIcon },
  { tab: 'rides',   label: 'My Rides', route: 'MyRides',   icon: RidesIcon },
  { tab: 'chat',    label: 'Chat',     route: 'ChatList',  icon: ChatIcon, hasNotification: true },
  { tab: 'profile', label: 'Profile',  route: 'Profile',   icon: ProfileIcon },
];

const driverTabs: NavItem[] = [
  { tab: 'home',     label: 'Home',     route: 'DriverHome',      icon: HomeIcon },
  { tab: 'rides',    label: 'Rides',    route: 'ManageRequests',  icon: DriverRidesIcon },
  { tab: 'earnings', label: 'Earnings', route: 'Earnings',        icon: EarningsIcon },
  { tab: 'chat',     label: 'Chat',     route: 'ChatList',        icon: ChatIcon, hasNotification: true },
  { tab: 'profile',  label: 'Profile',  route: 'DriverProfile',   icon: ProfileIcon },
];

// ─── TabItem Component ────────────────────────────────────────────────────────

interface TabItemProps {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
  primaryColor: string;
  surfaceColor: string;
  errorColor: string;
}

function TabItem({ item, isActive, onPress, primaryColor, surfaceColor, errorColor }: TabItemProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View style={[styles.tabItem, { transform: [{ scale }] }]}>
      <TouchableOpacity accessibilityRole="button"
        testID={`nav-tab-${item.tab}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.tabTouchable}
      >
        {/* Icon + notification dot */}
        <View testID="icon-wrapper" style={styles.iconWrapper}>
          {item.icon(isActive, primaryColor)}

          {item.hasNotification && (
            <View
              style={[
                styles.notificationDot,
                { backgroundColor: errorColor, borderColor: surfaceColor },
              ]}
            />
          )}
        </View>

        {/* Label */}
        <Text
          style={[
            styles.tabLabel,
            { color: isActive ? primaryColor : '#9CA3AF' },
            isActive && styles.tabLabelActive,
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── BottomNav Main Component ─────────────────────────────────────────────────

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const navigation = useNavigation<NavProp>();
  const { role, c } = useApp();
  const insets = useSafeAreaInsets();
  const tabs = role === 'driver' ? driverTabs : riderTabs;
  const tabCount = tabs.length;

  // ── Active underline indicator animation ──────────────────────────────────
  // The indicator slides to the active tab's x-position.
  const TAB_W = SCREEN_W / tabCount;
  const INDICATOR_W = 24;
  const indicatorX = useRef(
    new Animated.Value(
      tabs.findIndex(t => t.tab === activeTab) * TAB_W + (TAB_W - INDICATOR_W) / 2,
    ),
  ).current;

  useEffect(() => {
    const idx = tabs.findIndex(t => t.tab === activeTab);
    Animated.spring(indicatorX, {
      toValue: idx * TAB_W + (TAB_W - INDICATOR_W) / 2,
      useNativeDriver: true,
      stiffness: 350,
      damping: 30,
    }).start();
  }, [activeTab, tabs, TAB_W, indicatorX]);

  const handlePress = useCallback(
    (item: NavItem) => {
      Haptics.selectionAsync();
      onTabChange(item.tab);
      navigation.navigate(item.route as never);
    },
    [navigation, onTabChange],
  );

  return (
    <View
      testID="bottom-nav"
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          backgroundColor: c.surface,
          borderTopColor: c.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 12, // Android draws a bottom shadow; top shadow requires a workaround
        },
      ]}
    >
      {/* Sliding active tab indicator */}
      <Animated.View
        style={[
          styles.activeIndicator,
          { backgroundColor: c.primary },
          { transform: [{ translateX: indicatorX }] },
        ]}
      />

      {/* Tabs */}
      {tabs.map(item => (
        <TabItem
          key={item.tab}
          item={item}
          isActive={activeTab === item.tab}
          onPress={() => handlePress(item)}
          primaryColor={c.primary}
          surfaceColor={c.surface}
          errorColor={c.error}
        />
      ))}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingBottom: 4,
    position: 'relative',
  },

  // Sliding underline indicator at the very bottom
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 24,
    height: 3,
    borderRadius: 2,
  },

  tabItem: {
    flex: 1,
    height: '100%',
  },

  tabTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  iconWrapper: {
    position: 'relative', // needed for absolute notification dot
  },

  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },

  tabLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },

  tabLabelActive: {
    fontWeight: Typography.bold,
  },
});
