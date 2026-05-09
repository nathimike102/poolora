/**
 * theme/GlobalStyles.ts
 *
 * Reusable StyleSheet presets for typography (h1–h4, body, label, etc.)
 * and screen-level defaults.
 *
 * USAGE:
 *   import { GlobalTextStyles, ScreenStyle } from '../theme/GlobalStyles';
 *
 *   <View style={ScreenStyle.root}>
 *     <Text style={GlobalTextStyles.h1}>Title</Text>
 *     <Text style={GlobalTextStyles.body}>Paragraph text</Text>
 *   </View>
 */

import { StyleSheet, Platform } from 'react-native';
import { Typography, Spacing } from './index';
import { FontFamily } from './fonts';

// ---- Typography presets (replaces h1-h4, p, label, button, input rules) ------

export const GlobalTextStyles = StyleSheet.create({
  // h1: font-size: text-2xl (24px); font-weight: 500; line-height: 1.5
  h1: {
    fontSize: Typography['4xl'],          // 24dp (text-2xl = 24px)
    fontWeight: Typography.medium,        // --font-weight-medium: 500
    lineHeight: Typography['4xl'] * Typography.normal,
    fontFamily: FontFamily.medium,
  },

  // h2: font-size: text-xl (20px); font-weight: 500; line-height: 1.5
  h2: {
    fontSize: Typography['3xl'],          // 20dp
    fontWeight: Typography.medium,
    lineHeight: Typography['3xl'] * Typography.normal,
    fontFamily: FontFamily.medium,
  },

  // h3: font-size: text-lg (~18px); font-weight: 500; line-height: 1.5
  h3: {
    fontSize: Typography['2xl'],          // 17dp (closest to 18px)
    fontWeight: Typography.medium,
    lineHeight: Typography['2xl'] * Typography.normal,
    fontFamily: FontFamily.medium,
  },

  // h4: font-size: text-base (16px); font-weight: 500; line-height: 1.5
  h4: {
    fontSize: Typography.xl,              // 16dp
    fontWeight: Typography.medium,
    lineHeight: Typography.xl * Typography.normal,
    fontFamily: FontFamily.medium,
  },

  // label: same as h4
  label: {
    fontSize: Typography.xl,
    fontWeight: Typography.medium,
    lineHeight: Typography.xl * Typography.normal,
    fontFamily: FontFamily.medium,
  },

  // button: same as h4
  buttonText: {
    fontSize: Typography.xl,
    fontWeight: Typography.medium,
    lineHeight: Typography.xl * Typography.normal,
    fontFamily: FontFamily.medium,
  },

  // input: font-size: text-base (16px); font-weight: 400; line-height: 1.5
  inputText: {
    fontSize: Typography.xl,
    fontWeight: Typography.regular,       // --font-weight-normal: 400
    lineHeight: Typography.xl * Typography.normal,
    fontFamily: FontFamily.regular,
  },

  // body paragraph text
  body: {
    fontSize: Typography.xl,             // --font-size: 16px
    fontWeight: Typography.regular,
    lineHeight: Typography.xl * Typography.normal,
    fontFamily: FontFamily.regular,
  },

  // small / caption
  caption: {
    fontSize: Typography.sm,
    fontWeight: Typography.regular,
    lineHeight: Typography.sm * Typography.normal,
    fontFamily: FontFamily.regular,
  },
});

// ---- Screen root style -------------------------------------------------------
// Replaces: body { background: var(--background); color: var(--foreground); }
// Apply to the root View of each screen.

export const ScreenStyle = StyleSheet.create({
  root: {
    flex: 1,
    // backgroundColor set dynamically from theme: style={[ScreenStyle.root, { backgroundColor: c.bg }]}
  },
});

// ---- ScrollView defaults -----------------------------------------------------

export const ScrollViewDefaults = {
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
  keyboardShouldPersistTaps: 'handled' as const,
  overScrollMode: 'never' as const,           // Android: no overscroll glow
  bounces: true,                               // iOS: keep natural bounce
};

// ---- Focus ring style --------------------------------------------------------
// Replaces: outline-color: var(--ring)/50% on * {}
// Apply to focusable elements in web previews or accessibility contexts.

export const FocusRingStyle = StyleSheet.create({
  focused: {
    // React Native doesn't show focus rings by default.
    // This is used in custom TextInput wrappers to show a border
    // when the input is focused, replicating the CSS ring behaviour.
    borderWidth: 2,
    borderColor: '#9CA3AF80',  // --ring: oklch(0.708) at 50% opacity
  },
});

// ---- Platform-specific helpers -----------------------------------------------

export const isIOS     = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// iOS-style font smoothing equivalent (no direct API, but weight adjustments help)
export const PlatformFontStyle = Platform.select({
  ios: {
    // SF Pro already has great rendering; no extra adjustments needed
  },
  android: {
    // Roboto is the system font; enabling includeFontPadding: false
    // reduces excessive top padding Android adds to Text by default
    includeFontPadding: false,
  },
  default: {},
});
