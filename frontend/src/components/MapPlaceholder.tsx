/**
 * components/MapPlaceholder.tsx
 *
 * Stands in for a map when the build has no Google Maps key (see
 * config/maps.ts). Draws a few faint streets so the layout keeps its shape,
 * with an optional caption.
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { Icon } from './Icon';

interface MapPlaceholderProps {
  style?: StyleProp<ViewStyle>;
  /** Short line shown under the pin; omit for a purely decorative block */
  caption?: string;
}

export function MapPlaceholder({ style, caption }: MapPlaceholderProps) {
  const { c, isDarkMode } = useApp();
  const street = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(17,24,39,0.07)';

  return (
    <View
      testID="map-placeholder"
      style={[styles.root, { backgroundColor: isDarkMode ? '#16211F' : '#EAF1EF' }, style]}
      accessible={Boolean(caption)}
      accessibilityLabel={caption}
    >
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 240" preserveAspectRatio="xMidYMid slice">
        <Path d="M-20 60 C 80 40, 160 90, 380 50" stroke={street} strokeWidth={14} fill="none" />
        <Path d="M-20 170 C 100 150, 220 200, 380 160" stroke={street} strokeWidth={10} fill="none" />
        <Path d="M90 -20 C 110 80, 70 160, 120 260" stroke={street} strokeWidth={10} fill="none" />
        <Path d="M250 -20 C 230 90, 280 170, 240 260" stroke={street} strokeWidth={14} fill="none" />
      </Svg>
      <View style={[styles.pin, { backgroundColor: c.surface }]}>
        <Icon name="map-marker" size={22} color={c.primary} />
      </View>
      {caption ? (
        <Text style={[styles.caption, { color: c.textSec }]} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  caption: {
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
