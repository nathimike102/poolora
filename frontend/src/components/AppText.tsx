/**
 * components/AppText.tsx
 */

import React from 'react';
import {
  Text,
  StyleSheet,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { Typography } from '../theme';
import { FontFamily } from '../theme/fonts';
import { useApp } from '../context/AppContext';

// ---- Props ------------------------------------------------------------------

type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';
type FontSize = keyof typeof Typography;

interface AppTextProps extends TextProps {
  /** Convenience size token from Typography scale */
  size?: 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  /** Convenience weight token */
  weight?: FontWeight;
  /** Text colour — defaults to theme text colour */
  color?: string;
  /** Use secondary text colour */
  secondary?: boolean;
  /** Center aligned */
  center?: boolean;
  children: React.ReactNode;
}

// ---- Font family picker -----------------------------------------------------

function fontFamilyForWeight(weight: FontWeight): string {
  switch (weight) {
    case 'regular':   return FontFamily.regular;
    case 'medium':    return FontFamily.medium;
    case 'semibold':  return FontFamily.semiBold;
    case 'bold':      return FontFamily.bold;
    case 'extrabold': return FontFamily.extraBold;
    default:          return FontFamily.regular;
  }
}

// ---- Component --------------------------------------------------------------

export function AppText({
  size,
  weight = 'regular',
  color,
  secondary = false,
  center = false,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { c } = useApp();

  const resolvedColor = color ?? (secondary ? c.textSec : c.text);
  const fontSize = size ? Typography[size] as number : undefined;
  const fontFamily = fontFamilyForWeight(weight);
  const fontWeight = Typography[weight] as TextStyle['fontWeight'];

  return (
    <Text
      style={[
        styles.base,
        fontSize !== undefined && { fontSize },
        { fontFamily, fontWeight, color: resolvedColor },
        center && styles.center,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

// ---- Heading Variants -------------------------------------------------------
// Convenience wrappers matching the h1-h4 defaults from theme.css @layer base

export const H1 = (props: Omit<AppTextProps, 'size' | 'weight'>) => (
  <AppText size="4xl" weight="medium" {...props} />
);

export const H2 = (props: Omit<AppTextProps, 'size' | 'weight'>) => (
  <AppText size="3xl" weight="medium" {...props} />
);

export const H3 = (props: Omit<AppTextProps, 'size' | 'weight'>) => (
  <AppText size="2xl" weight="medium" {...props} />
);

export const H4 = (props: Omit<AppTextProps, 'size' | 'weight'>) => (
  <AppText size="xl" weight="medium" {...props} />
);

export const BodyText = (props: Omit<AppTextProps, 'size'>) => (
  <AppText size="xl" {...props} />
);

export const Caption = (props: Omit<AppTextProps, 'size'>) => (
  <AppText size="sm" secondary {...props} />
);

// ---- Styles -----------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    // includeFontPadding: false removes Android's extra top padding on Text
    // This matches web behaviour where line-height controls spacing precisely
    includeFontPadding: false,
  },
  center: {
    textAlign: 'center',
  },
});
