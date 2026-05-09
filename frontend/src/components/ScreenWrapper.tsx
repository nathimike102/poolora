/**
 * components/ScreenWrapper.tsx
 *
 * Safe-area-aware screen container with optional ScrollView.
 * Pass scrollable={true} for screens that need vertical scroll.
 */

import React, { type ReactNode } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

interface ScreenWrapperProps {
  children: ReactNode;
  backgroundColor?: string;
  scrollable?: boolean;
  style?: ViewStyle;
  /** 'dark' = white icons (for coloured/dark backgrounds), 'light' = dark icons */
  statusBarStyle?: 'dark' | 'light';
  /** Removes horizontal padding — useful for map/full-bleed screens */
  noPadding?: boolean;
}

export function ScreenWrapper({
  children,
  backgroundColor = '#F9FAFB',
  scrollable = false,
  style,
  statusBarStyle = 'dark',
  noPadding = false,
}: ScreenWrapperProps) {
  const inner = scrollable ? (
    // ScrollViewDefaults applies showsVerticalScrollIndicator={false} etc.
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.scrollContent,
        !noPadding && styles.padding,
      ]}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[styles.flex, !noPadding && styles.padding, style]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={statusBarStyle} />
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  padding: {
    paddingHorizontal: 24,
  },
});
