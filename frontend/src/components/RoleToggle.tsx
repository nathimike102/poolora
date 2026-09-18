/**
 * components/RoleToggle.tsx
 *
 * Rider / Driver toggle with animated sliding pill.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { Typography, Radius, Shadow } from '../theme';

export function RoleToggle() {
  const { role, switchRole } = useApp();
  const isRider = role === 'rider';

  // ── Sliding pill animation ─────────────────────────────────────────────────
  const containerRef = useRef<View>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;

  const tabWidth = containerWidth > 0 ? (containerWidth - 8) / 2 : 0; // Account for padding

  useEffect(() => {
    if (tabWidth > 0) {
      Animated.spring(pillX, {
        toValue: isRider ? 0 : tabWidth,
        useNativeDriver: true,
        stiffness: 400,
        damping: 30,
      }).start();
    }
  }, [isRider, pillX, tabWidth]);

  return (
    <View
      ref={containerRef}
      testID="role-toggle-container"
      style={styles.container}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      {/* Animated sliding pill (sits behind tab labels) */}
      <Animated.View
        style={[
          styles.pill,
          {
            width: tabWidth,
            // translateX slides the pill between left (Rider) and right (Driver)
            transform: [{ translateX: pillX }],
          },
          Shadow.primary('#0B7A75'),
        ]}
      />

      {/* ── Rider Tab ────────────────────────────────────────────────────── */}
      <TouchableOpacity
        testID="role-toggle-rider"
        onPress={() => { if (!isRider) switchRole(); }}
        activeOpacity={isRider ? 1 : 0.7} // no feedback when already active
        accessibilityRole="tab"
        accessibilityState={{ selected: isRider }}
        style={styles.tab}
      >
        <Icon name="account" size={18} color={isRider ? '#FFFFFF' : 'rgba(255,255,255,0.75)'} />
        <Text
          style={[
            styles.tabLabel,
            { color: isRider ? '#FFFFFF' : 'rgba(255,255,255,0.75)' },
          ]}
        >
          Rider
        </Text>
      </TouchableOpacity>

      {/* ── Driver Tab ───────────────────────────────────────────────────── */}
      <TouchableOpacity
        testID="role-toggle-driver"
        onPress={() => { if (isRider) switchRole(); }}
        activeOpacity={!isRider ? 1 : 0.7}
        accessibilityRole="tab"
        accessibilityState={{ selected: !isRider }}
        style={styles.tab}
      >
        <Icon name="steering" size={18} color={!isRider ? '#FFFFFF' : 'rgba(255,255,255,0.75)'} />
        <Text
          style={[
            styles.tabLabel,
            { color: !isRider ? '#FFFFFF' : 'rgba(255,255,255,0.75)' },
          ]}
        >
          Driver
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: Radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    position: 'relative',       // needed so pill's absolute position is relative to this
    overflow: 'hidden',
  },

  // Sliding highlight pill
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: Radius.md,
    backgroundColor: '#0B7A75', // solid fallback; use expo-linear-gradient for gradient
  },

  tab: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    // z-index via render order: pill is rendered first so tabs appear on top
    zIndex: 1,
  },

  tabEmoji: {
    fontSize: 15,
  },

  tabLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    letterSpacing: 0.2,
  },
});
