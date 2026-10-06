/**
 * components/ScreenHeader.tsx
 *
 * The top of every pushed screen, as in Uber: a plain back arrow, an optional
 * action on the right, and the screen's name large and bold below them.
 * `compact` puts a smaller name beside the arrow instead, for screens whose
 * content needs the room (a chat, a map). The screen pads the safe area.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { Text } from './Text';
import { Spacing, Typography } from '../theme';
import { tc, tk } from '../theme/themed';

interface Props {
  title: string;
  subtitle?: string;
  /** Instead of going back, e.g. to confirm leaving a half-filled form */
  onBack?: () => void;
  /** Hide the arrow on a screen that is the first of its stack */
  noBack?: boolean;
  /** A control on the right of the arrow row, such as "Mark all read" */
  right?: React.ReactNode;
  compact?: boolean;
}

export function ScreenHeader({ title, subtitle, onBack, noBack, right, compact }: Props) {
  const navigation = useNavigation();
  const { t } = useTranslation();

  const back = noBack ? null : (
    <Pressable
      testID="back-button"
      onPress={onBack ?? (() => navigation.goBack())}
      accessibilityRole="button"
      accessibilityLabel={t('backButton.goBack')}
      hitSlop={8}
      style={({ pressed }) => [styles.back, pressed && tc.backgroundColor_surfaceVariant]}
    >
      <Icon name="arrow-left" size={26} color={tk.text} />
    </Pressable>
  );

  if (compact) {
    return (
      <View style={[
        styles.bar,
        styles.compactBar,
        tc.backgroundColor_surface,
        tc.borderBottomColor_border
      ]}>
        {back}
        <View style={styles.flex1}>
          <Text accessibilityRole="header" style={[styles.compactTitle, tc.color_text]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, tc.color_textSec]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, tc.backgroundColor_surface]}>
      <View style={styles.bar}>
        {back}
        <View style={styles.flex1} />
        {right}
      </View>
      <Text accessibilityRole="header" style={[styles.title, tc.color_text]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, styles.subtitleLarge, tc.color_textSec]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  wrap: { paddingBottom: Spacing.md },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  compactBar: { borderBottomWidth: StyleSheet.hairlineWidth, paddingRight: Spacing.lg },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: Typography['6xl'],
    fontWeight: Typography.extrabold,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xs,
  },
  compactTitle: { fontSize: Typography['3xl'], fontWeight: Typography.bold },
  subtitle: { fontSize: Typography.md },
  subtitleLarge: { paddingHorizontal: Spacing.xl, marginTop: Spacing.xs, fontSize: Typography.lg },
});
