/**
 * components/LiveMap.web.tsx
 *
 * Web fallback for LiveMap.
 * `react-native-maps` is native-only in this project setup, so this component
 * avoids importing it on web and renders a lightweight placeholder.
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

interface LiveMapProps {
  showRoute?: boolean;
  showDriver?: boolean;
  style?: ViewStyle;
}

export function LiveMap({ showRoute = false, showDriver = false, style }: LiveMapProps) {
  return (
    <View testID="live-map" style={[styles.container, style]}>
      <Text style={styles.title}>Map preview is unavailable on web build</Text>
      <Text style={styles.subtext}>Use Android/iOS build for full map experience.</Text>
      <View style={styles.badges}>
        {showRoute ? <Text style={styles.badge}>Route</Text> : null}
        {showDriver ? <Text style={styles.badge}>Driver</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#263042',
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  title: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtext: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  badge: {
    backgroundColor: '#0B2447',
    color: '#E8EEF9',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
