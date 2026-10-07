/**
 * components/AvatarRing.tsx
 *
 * The person's picture, or their initial, inside a ring that fills as much
 * of the circle as their profile is complete: a third filled at 33%.
 * Pressing it is how they add or change the picture.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from './ThemedSvg';
import { useTranslation } from 'react-i18next';

import { ImageWithFallback } from './ImageWithFallback';
import { Icon } from './Icon';
import { Text } from './Text';
import { Typography } from '../theme';
import { tc, tk } from '../theme/themed';

interface Props {
  name: string;
  photoUrl?: string | null;
  /** 0 to 1 */
  progress: number;
  onPress?: () => void;
  size?: number;
}

const STROKE = 3;
const GAP = 4;

export function AvatarRing({ name, photoUrl, progress, onPress, size = 80 }: Props) {
  const { t } = useTranslation();
  const r = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, progress));
  const inner = size - 2 * (STROKE + GAP);
  const percent = Math.round(filled * 100);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('setup.photoTitle')}. ${t('profile.complete', { percent })}`}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={tk.border} strokeWidth={STROKE} fill="none" />
        {filled > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={filled >= 1 ? tk.success : tk.primary}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * filled} ${circumference}`}
            // Starts at the top and runs clockwise
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={[styles.inner, { top: STROKE + GAP, left: STROKE + GAP, width: inner, height: inner, borderRadius: inner / 2 }, tc.backgroundColor_surfaceVariant]}>
        {photoUrl ? (
          <ImageWithFallback src={photoUrl} alt={name} width={inner} height={inner} borderRadius={inner / 2} />
        ) : name ? (
          <Text style={[styles.initial, tc.color_text]}>{name.charAt(0).toUpperCase()}</Text>
        ) : (
          <Icon name="account" size={inner / 2} color={tk.textSec} />
        )}
      </View>
      {onPress ? (
        <View style={[styles.badge, tc.backgroundColor_text, tc.borderColor_surface]}>
          <Icon name="camera" size={14} color={tk.surface} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontSize: 26, fontWeight: Typography.bold },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
