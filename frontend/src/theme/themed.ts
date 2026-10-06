/**
 * theme/themed.ts
 *
 * The app's theme without React re-renders. Colours in styles use tc
 * (theme/tc.ts), which Unistyles repaints natively. A colour passed as a prop
 * (an icon's colour, a placeholder) is a token from tk, and the component that
 * draws it resolves it with useThemeColor, so only that component re-renders
 * when the theme changes, not the screen around it.
 *
 *   <View style={[styles.card, tc.backgroundColor_surface]} />
 *   <Icon name="star" color={active ? tk.primary : tk.textSec} />
 */

import type { ColorValue } from 'react-native';
import { UnistylesRuntime, useUnistyles } from 'react-native-unistyles';

import type { AppColors } from './index';

export { tc } from './tc';

export type ColorToken = Exclude<keyof AppColors, 'cardLift'>;

/** A theme colour handed to a component as a prop; see useThemeColor */
export interface ThemeColor {
  readonly themeColor: ColorToken;
}

/** A plain colour or a theme colour */
export type AnyColor = ColorValue | ThemeColor;

const TOKENS: ColorToken[] = [
  'primary', 'primaryDark', 'primaryLight', 'success', 'successDark', 'successLight',
  'warning', 'warningLight', 'error', 'errorLight', 'star', 'heart', 'info', 'infoLight',
  'green', 'greenLight', 'bg', 'surface', 'surfaceVariant', 'border', 'shadow',
  'muted', 'mutedFg', 'accent', 'inputBg', 'switchBg',
  'text', 'textSec', 'textDisabled', 'textOnPrimary',
];

/** Theme colours as props: color={tk.textSec} */
export const tk = Object.freeze(
  Object.fromEntries(TOKENS.map(t => [t, Object.freeze({ themeColor: t })])),
) as { readonly [K in ColorToken]: ThemeColor };

export function isThemeColor(value: unknown): value is ThemeColor {
  return typeof value === 'object' && value !== null && 'themeColor' in value;
}

/**
 * The colour to draw. A theme colour re-renders this component (only) when the
 * theme changes; a plain colour passes through.
 */
export function useThemeColor(value: AnyColor): ColorValue;
export function useThemeColor(value: AnyColor | undefined): ColorValue | undefined;
export function useThemeColor(value: AnyColor | undefined): ColorValue | undefined {
  const { theme } = useUnistyles();
  return isThemeColor(value) ? theme.colors[value.themeColor] : value;
}

/** The whole palette, for the few places that draw outside styles (maps, SVG) */
export function useColors(): AppColors {
  return useUnistyles().theme.colors;
}

/** Whether the dark theme is showing; re-renders only the component asking */
export function useIsDark(): boolean {
  return useUnistyles().rt.themeName === 'dark';
}

/** The palette right now, outside React (navigation themes, alerts) */
export function currentColors(): AppColors {
  return UnistylesRuntime.getTheme().colors;
}
