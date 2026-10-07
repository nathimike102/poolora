/**
 * theme/unistyles.ts
 *
 * Registers the light and dark themes with Unistyles. Styles written against
 * the theme (theme/themed.ts) are updated natively when the theme changes, so
 * switching dark mode repaints the screen without React re-rendering it.
 * Imported first, from index.ts, because every themed StyleSheet needs it.
 */

import { StyleSheet } from 'react-native-unistyles';

import { DarkColors, LightColors, type AppColors } from './index';

const light = { colors: LightColors };
const dark = { colors: DarkColors as AppColors };

type AppThemes = { light: typeof light; dark: typeof dark };

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: { light, dark },
  // Follows the phone until the user picks a theme (AppContext restores it)
  settings: { adaptiveThemes: true },
});
