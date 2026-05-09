/**
 * components/MobileFrame.tsx
 *
 * A <DeviceStatusBar> component that renders a realistic status bar
 * for Storybook / screenshot previews.
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Rect, Circle, Path, Line as SvgLine } from 'react-native-svg';

import { useApp } from '../context/AppContext';

interface DeviceStatusBarProps {
  style?: ViewStyle;
}

/**
 * A realistic-looking status bar for use in design previews / Storybook.
 * In production builds use expo-status-bar instead.
 */
export function DeviceStatusBar({ style }: DeviceStatusBarProps) {
  const { c } = useApp();

  return (
    <View testID="device-status-bar" style={[styles.statusBar, style]}>
      <Text style={[styles.time, { color: c.text }]}>9:41</Text>

      <View style={styles.indicators}>
        {/* Signal bars */}
        <Svg width={17} height={12} viewBox="0 0 17 12">
          <Rect x={0}    y={6}   width={3} height={6}    rx={1} fill={c.text} />
          <Rect x={4.5}  y={4}   width={3} height={8}    rx={1} fill={c.text} />
          <Rect x={9}    y={1.5} width={3} height={10.5} rx={1} fill={c.text} />
          <Rect x={13.5} y={0}   width={3} height={12}   rx={1} fill={c.text} />
        </Svg>

        {/* WiFi */}
        <Svg width={16} height={12} viewBox="0 0 16 12">
          <Circle cx={8} cy={9.5} r={1.5} fill={c.text} />
          <Path d="M3.5 6.5C5 5 6.4 4.2 8 4.2s3 .8 4.5 2.3"
            strokeWidth={1.5} stroke={c.text} fill="none" strokeLinecap="round" />
          <Path d="M1 4C3.2 1.8 5.5.8 8 .8s4.8 1 7 3.2"
            strokeWidth={1.5} stroke={c.text} fill="none" strokeLinecap="round" />
        </Svg>

        {/* Battery */}
        <View style={styles.battery}>
          <View style={[styles.batteryBody, { borderColor: c.text }]}>
            <View style={[styles.batteryFill, { backgroundColor: c.text }]} />
          </View>
          <View style={[styles.batteryNub, { backgroundColor: c.text }]} />
        </View>
      </View>
    </View>
  );
}

/**
 * Wraps screen content with a DeviceStatusBar at the top.
 * Only use this in Storybook / screenshot tooling.
 *
 * In the real app, use:
 *   import { StatusBar } from 'expo-status-bar';
 *   <StatusBar style="dark" />
 */
interface DevicePreviewWrapperProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

export function DevicePreviewWrapper({
  children,
  backgroundColor,
}: DevicePreviewWrapperProps) {
  const { c } = useApp();

  return (
    <View style={[styles.wrapper, { backgroundColor: backgroundColor ?? c.bg }]}>
      <DeviceStatusBar />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },

  statusBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 4,
  },

  time: {
    fontSize: 15,
    fontWeight: '600',
  },

  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  battery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  batteryBody: {
    width: 25,
    height: 13,
    borderWidth: 1.5,
    borderRadius: 3,
    padding: 2,
  },
  batteryFill: {
    height: '100%',
    width: '75%',
    borderRadius: 1,
  },
  batteryNub: {
    width: 2,
    height: 6,
    borderRadius: 1,
    opacity: 0.4,
  },
});
