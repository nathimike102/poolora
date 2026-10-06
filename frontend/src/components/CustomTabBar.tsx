/**
 * components/CustomTabBar.tsx
 *
 * Custom tab bar for @react-navigation/bottom-tabs.
 * Renders the same visual design as the old BottomNav but
 * integrates with React Navigation's tab state automatically.
 */

import React, { useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Text } from './Text';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect } from './ThemedSvg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '../theme';

import { tc, useColors } from '../theme/themed';

const TAB_BAR_HEIGHT = 68;

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

const ServicesIcon = (active: boolean, color: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24"
    fill={active ? color : 'none'}
    stroke={active ? color : '#9CA3AF'}
    strokeWidth={2}
  >
    <Rect x={3} y={3} width={7} height={7} rx={1.5} />
    <Rect x={14} y={3} width={7} height={7} rx={1.5} />
    <Rect x={3} y={14} width={7} height={7} rx={1.5} />
    <Rect x={14} y={14} width={7} height={7} rx={1.5} />
  </Svg>
);

// Map route names to icons
const iconMap: Record<string, (active: boolean, color: string) => React.ReactElement> = {
  RiderHome: HomeIcon,
  Search: SearchIcon,
  Services: ServicesIcon,
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
}

function TabItem({ label, routeName, isActive, onPress }: TabItemProps) {
  // A tab item is small, so it re-renders itself for a theme change
  const c = useColors();
  const primaryColor = c.primary;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };

  const renderIcon = iconMap[routeName];

  return (
    <Animated.View style={[styles.tabItem, { transform: [{ scale }] }]}>
      <TouchableOpacity accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={label}
        testID={`custom-tab-${routeName}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.tabTouchable}
      >
        {/* The open tab's icon sits in a glowing dot of the brand colour */}
        <View
          style={[
            styles.iconWrapper,
            isActive && [styles.iconDot, { backgroundColor: primaryColor, boxShadow: `0 0 12px ${primaryColor}` }],
          ]}
        >
          {renderIcon ? renderIcon(isActive, isActive ? c.textOnPrimary : c.textSec) : null}
        </View>
        <Text
          numberOfLines={1}
          style={[styles.tabLabel, isActive ? tc.color_text : tc.color_textSec, isActive && styles.tabLabelActive]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── CustomTabBar ─────────────────────────────────────────────────────────────

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

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
    // A floating pill above the system bar, as on Uber; the strip around it
    // matches the screens' surface so it reads as part of the page
    <View
      testID="custom-tab-bar"
      style={[styles.container, { paddingBottom: insets.bottom + 10 }, tc.backgroundColor_surface]}
    >
      <View
        style={[styles.pill, tc.backgroundColor_surfaceVariant, tc.borderColor_border]}
      >
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
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 6,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  tabItem: { flex: 1, height: TAB_BAR_HEIGHT - 12 },
  tabTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: (TAB_BAR_HEIGHT - 12) / 2,
  },
  iconWrapper: { height: 24, justifyContent: 'center' },
  iconDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginVertical: -5 },
  tabLabel: { fontSize: Typography.xs, fontWeight: Typography.medium },
  tabLabelActive: { fontWeight: Typography.bold },
});
