/**
 * components/EmptyState.tsx
 *
 * What a list shows before it has anything in it: a 3D object, a short
 * title, a line saying what will appear here, and optionally a way to start.
 */

import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon3D, type Icon3DName } from './Icon3D';
import { Text } from './Text';
import { Radius, Spacing, Typography } from '../theme';

import { tc } from '../theme/themed';

interface Props {
  icon: Icon3DName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

/** The 3D object on its soft circle, for empty states laid out by the screen */
export function EmptyArt({ icon }: { icon: Icon3DName }) {
  return (
    <View style={[styles.art, tc.backgroundColor_surfaceVariant]}>
      <Icon3D name={icon} size={72} />
    </View>
  );
}

export function EmptyState({ icon, title, body, action, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <EmptyArt icon={icon} />
      <Text style={[styles.title, tc.color_text]} accessibilityRole="header">{title}</Text>
      {body ? <Text style={[styles.body, tc.color_textSec]}>{body}</Text> : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.85 : 1 }, tc.backgroundColor_text]}
        >
          <Text style={[styles.actionText, tc.color_surface]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing['3xl'] },
  art: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  title: { fontSize: Typography['3xl'], fontWeight: Typography.bold, textAlign: 'center' },
  body: { fontSize: Typography.lg, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
  action: { marginTop: Spacing.xl, paddingHorizontal: Spacing['2xl'], minHeight: 48, borderRadius: Radius.full, justifyContent: 'center' },
  actionText: { fontSize: Typography.xl, fontWeight: Typography.bold },
});
