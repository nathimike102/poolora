/**
 * components/CustomTabBar.tsx
 *
 * Custom tab bar for @react-navigation/bottom-tabs.
 * Renders the same visual design as the old BottomNav but
 * integrates with React Navigation's tab state automatically.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { Typography } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── SVG Icons ─────────────────────────────────────────────────────────────────

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

const SearchIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill="none"
    stroke={active ? color : '#9CA3AF'}
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

const RequestsIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill={active ? color : 'none'}
    stroke={active ? color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Path d="M9 17H5a2 2 0 00-2 2v1h18v-1a2 2 0 00-2-2h-4M12 3a4 4 0 00-4 4v4a4 4 0 004 4 4 4 0 004-4V7a4 4 0 00-4-4z"
      strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CreateRideIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill={active ? color : 'none'}
    stroke={active ? color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Map route names to icons
const iconMap: Record<string, (active: boolean, color: string) => React.ReactElement> = {
  RiderHome: HomeIcon,
  Search: SearchIcon,
  MyRides: RidesIcon,
  ChatList: ChatIcon,
  Profile: ProfileIcon,
  DriverHome: HomeIcon,
  CreateRide: CreateRideIcon,
  ManageRequests: RequestsIcon,
  DriverProfile: ProfileIcon,
};

// ─── Tab Item ─────────────────────────────────────────────────────────────────

interface TabItemProps {
  label: string;
  routeName: string;
  isActive: boolean;
  onPress: () => void;
  primaryColor: string;
}

function TabItem({ label, routeName, isActive, onPress, primaryColor }: TabItemProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };

  const renderIcon = iconMap[routeName];

  return (
    <Animated.View style={[styles.tabItem, { transform: [{ scale }] }]}>
      <TouchableOpacity accessibilityRole="button"
        testID={`custom-tab-${routeName}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.tabTouchable}
      >
        <View style={styles.iconWrapper}>
          {renderIcon ? renderIcon(isActive, primaryColor) : null}
        </View>
        <Text
          style={[
            styles.tabLabel,
            { color: isActive ? primaryColor : '#9CA3AF' },
            isActive && styles.tabLabelActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── CustomTabBar ─────────────────────────────────────────────────────────────

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;

  const TAB_W = SCREEN_W / tabCount;
  const INDICATOR_W = 24;
  const indicatorX = useRef(
    new Animated.Value(state.index * TAB_W + (TAB_W - INDICATOR_W) / 2),
  ).current;

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: state.index * TAB_W + (TAB_W - INDICATOR_W) / 2,
      useNativeDriver: true,
      stiffness: 350,
      damping: 30,
    }).start();
  }, [state.index, TAB_W, indicatorX]);

  const handlePress = useCallback(
    (routeName: string, routeKey: string, isFocused: boolean) => {
      Haptics.selectionAsync();
      const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation],
  );

  return (
    <View
      testID="custom-tab-bar"
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
          elevation: 12,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.activeIndicator,
          { backgroundColor: c.primary },
          { transform: [{ translateX: indicatorX }] },
        ]}
      />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = (options.title ?? route.name) as string;
        const isFocused = state.index === index;

        return (
          <TabItem
            key={route.key}
            label={label}
            routeName={route.name}
            isActive={isFocused}
            onPress={() => handlePress(route.name, route.key, isFocused)}
            primaryColor={c.primary}
          />
        );
      })}
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
    position: 'relative',
  },
  tabLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
  tabLabelActive: {
    fontWeight: Typography.bold,
  },
});
