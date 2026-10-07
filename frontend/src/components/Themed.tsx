/**
 * components/Themed.tsx
 *
 * React Native controls whose colours are props rather than styles, taking
 * theme colours (tk) as well as plain ones. Each resolves its own colours, so
 * a theme change re-renders the control and not the screen around it.
 */

import React from 'react';
import {
  ActivityIndicator as RNActivityIndicator,
  RefreshControl as RNRefreshControl,
  Switch as RNSwitch,
  type ActivityIndicatorProps,
  type RefreshControlProps,
  type SwitchProps,
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useUnistyles } from 'react-native-unistyles';

import { isThemeColor, useThemeColor, type AnyColor } from '../theme/themed';

export function ActivityIndicator({ color, ...rest }: Omit<ActivityIndicatorProps, 'color'> & { color?: AnyColor }) {
  return <RNActivityIndicator color={useThemeColor(color)} {...rest} />;
}

type SwitchColors = { false?: AnyColor | null; true?: AnyColor | null };

export function Switch({ trackColor, thumbColor, ios_backgroundColor, ...rest }: Omit<SwitchProps, 'trackColor' | 'thumbColor' | 'ios_backgroundColor'> & {
  trackColor?: SwitchColors;
  thumbColor?: AnyColor;
  ios_backgroundColor?: AnyColor;
}) {
  const { theme } = useUnistyles();
  const pick = (v: AnyColor | null | undefined) => (isThemeColor(v) ? theme.colors[v.themeColor] : v);
  return (
    <RNSwitch
      trackColor={trackColor && { false: pick(trackColor.false), true: pick(trackColor.true) }}
      thumbColor={pick(thumbColor) ?? undefined}
      ios_backgroundColor={pick(ios_backgroundColor) ?? undefined}
      {...rest}
    />
  );
}

export function RefreshControl({ colors, tintColor, progressBackgroundColor, ...rest }: Omit<RefreshControlProps, 'colors' | 'tintColor' | 'progressBackgroundColor'> & {
  colors?: AnyColor[];
  tintColor?: AnyColor;
  progressBackgroundColor?: AnyColor;
}) {
  const { theme } = useUnistyles();
  const pick = (v: AnyColor | undefined) => (isThemeColor(v) ? theme.colors[v.themeColor] : v);
  return (
    <RNRefreshControl
      colors={colors?.map(pick).filter((v): v is NonNullable<typeof v> => v != null)}
      tintColor={pick(tintColor)}
      progressBackgroundColor={pick(progressBackgroundColor)}
      {...rest}
    />
  );
}

type GradientProps = React.ComponentProps<typeof ExpoLinearGradient>;

/** expo-linear-gradient with theme colours allowed in its colour stops */
export function LinearGradient({ colors, ...rest }: Omit<GradientProps, 'colors'> & { colors: readonly [AnyColor, AnyColor, ...AnyColor[]] }) {
  const { theme } = useUnistyles();
  const stops = colors.map(v => (isThemeColor(v) ? theme.colors[v.themeColor] : v)) as unknown as GradientProps['colors'];
  return <ExpoLinearGradient colors={stops} {...rest} />;
}
