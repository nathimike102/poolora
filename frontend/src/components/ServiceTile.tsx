/**
 * components/ServiceTile.tsx
 *
 * A service as a 3D object on a soft rounded tile, with its name below and an
 * optional badge on top ("New", "50% off"), as on Uber's Home and Services.
 * Four fit across a phone, so the width is set by the grid that holds them.
 */

import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';

import { Icon3D, type Icon3DName } from './Icon3D';
import { tc } from '../theme/themed';

interface Props {
  icon: Icon3DName;
  label: string;
  onPress: () => void;
  badge?: string;
  style?: StyleProp<ViewStyle>;
}

export function ServiceTile({ icon, label, onPress, badge, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      style={({ pressed }) => [styles.tile, style, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
    >
      <View style={[styles.card, tc.backgroundColor_surfaceVariant, tc.cardOutline]}>
        <Icon3D name={icon} size={52} />
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>{badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.label, tc.color_text]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

/** Four tiles a row, with even gaps */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: '4%', rowGap: 16, paddingTop: 6 },
  tile: { width: '22%', alignItems: 'center', gap: 6 },
  card: { width: '100%', aspectRatio: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -8, alignSelf: 'center', backgroundColor: '#FF3B30', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  // Long names (and longer languages) wrap to a second line rather than cut off
  label: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
