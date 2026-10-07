/**
 * theme/index.ts
 *
 * CSS FILES -> NATIVE EQUIVALENTS (complete mapping)
 *
 * ---- index.css ----
 * Eliminated entirely. No global CSS exists in React Native.
 * The three @import lines are replaced by explicit TypeScript imports.
 *
 * ---- tailwind.css ----
 * Eliminated entirely.
 * - @import 'tailwindcss'      -> no equivalent needed; RN uses StyleSheet
 * - @source '../**\/*.tsx'     -> no source scanning; styles are co-located
 * - @import 'tw-animate-css'   -> eliminated; animations use Animated API
 * - className="flex-1 gap-3"  -> style={[styles.flex, styles.gap3]}
 * All Tailwind spacing/radius/color values baked into the scale constants below.
 *
 * ---- fonts.css ----
 * @import url('https://fonts.googleapis.com/...Inter...')
 *   -> Google Fonts CDN is unavailable in React Native. The app uses the
 *      platform font (Roboto on Android, San Francisco on iOS); adding Inter
 *      would mean loading it with expo-font and setting fontFamily on text.
 *      Without custom fonts loaded, RN uses the system font
 *      (San Francisco on iOS, Roboto on Android).
 *
 * ---- theme.css (:root CSS variables -> TypeScript tokens) ----
 *
 * --font-size: 16px            -> Typography.xl = 16
 * --background: #ffffff        -> LightColors.bg (grey50 for app screens)
 * --foreground: oklch(0.145)   -> LightColors.text = '#111827'
 * --card: #ffffff              -> LightColors.surface = '#FFFFFF'
 * --primary: #030213           -> shadcn default; overridden to Brand.teal '#087F8C' (from the logo)
 * --secondary: oklch(0.95...)  -> LightColors.surfaceVariant = '#F3F4F6'
 * --muted: #ececf0             -> LightColors.muted = '#ECECF0'
 * --muted-foreground: #717182  -> LightColors.mutedFg = '#717182'
 * --accent: #e9ebef            -> LightColors.accent
 * --destructive: #d4183d       -> LightColors.error (app uses '#EF4444')
 * --border: rgba(0,0,0,0.1)    -> LightColors.border = '#E5E7EB'
 * --input-background: #f3f3f5  -> LightColors.inputBg
 * --switch-background: #cbced4 -> LightColors.switchBg
 * --radius: 0.625rem           -> Radius.md (10px -> 12dp for mobile)
 * --ring: oklch(0.708)         -> '#9CA3AF'
 * Sidebar tokens               -> Not applicable in RN (no sidebar pattern)
 * Chart tokens                 -> ChartColors export below
 *
 * oklch() values converted to hex:
 *   oklch(0.145 0 0)  -> #111827   oklch(0.985 0 0) -> #F9FAFB
 *   oklch(0.95 0.006) -> #F3F4F6   oklch(0.269 0 0) -> #374151
 *   oklch(0.708 0 0)  -> #9CA3AF   oklch(0.205 0 0) -> #374151 (approx)
 *
 * .dark {} overrides -> DarkColors object (registered with Unistyles in theme/unistyles.ts;
 *   screens use theme/themed, so a theme change repaints natively)
 *
 * scrollbar-width: none -> showsVerticalScrollIndicator={false} on ScrollView
 */

import { MD3LightTheme, MD3DarkTheme, type MD3Theme } from 'react-native-paper';

// ---- Colour Palette ----------------------------------------------------------

/**
 * Siham brand colours, from the logo (branding/README.md). Teal leads, navy
 * gives structure, ivory adds warmth. Bright teal and aqua fail contrast with
 * white text, so they are for accents and dark backgrounds only.
 */
export const Brand = {
  navy:       '#0B2530',
  navyDeep:   '#061A22',
  ivory:      '#F5F1E7',
  teal:       '#087F8C',
  deepTeal:   '#056981',
  brightTeal: '#0AA2A8',
  aqua:       '#35D0BA',
} as const;

export const Palette = {
  primary:      Brand.teal,
  primaryDark:  Brand.deepTeal,
  primaryLight: '#E0F2F3',

  success:      '#10B981',
  successDark:  '#059669',
  successLight: '#D1FAE5',

  warning:      '#F59E0B',
  warningLight: '#FEF3C7',

  error:        '#EF4444',
  errorLight:   '#FEE2E2',

  info:         '#3B82F6',
  infoLight:    '#DBEAFE',

  green:        '#00C853',
  greenLight:   '#E8F5E9',

  white: '#FFFFFF',
  black: '#000000',

  grey50:  '#F9FAFB',
  grey100: '#F3F4F6',
  grey200: '#E5E7EB',
  grey300: '#D1D5DB',
  grey400: '#9CA3AF',
  grey500: '#6B7280',
  grey600: '#4B5563',
  grey700: '#374151',
  grey800: '#1F2937',
  grey900: '#111827',
} as const;

// ---- Shadcn theme.css tokens (exact values, oklch converted to hex) ----------

export const ShadcnTokens = {
  light: {
    background:    '#FFFFFF',
    foreground:    '#111827',
    card:          '#FFFFFF',
    cardFg:        '#111827',
    primary:       '#030213',
    primaryFg:     '#FFFFFF',
    secondary:     '#F3F4F6',
    secondaryFg:   '#030213',
    muted:         '#ECECF0',
    mutedFg:       '#717182',
    accent:        '#E9EBEF',
    accentFg:      '#030213',
    destructive:   '#D4183D',
    destructiveFg: '#FFFFFF',
    border:        'rgba(0,0,0,0.10)',
    inputBg:       '#F3F3F5',
    switchBg:      '#CBCED4',
    ring:          '#9CA3AF',
    radius:        10,
  },
  dark: {
    background:    '#111827',
    foreground:    '#F9FAFB',
    card:          '#111827',
    cardFg:        '#F9FAFB',
    primary:       '#F9FAFB',
    primaryFg:     '#374151',
    secondary:     '#374151',
    secondaryFg:   '#F9FAFB',
    muted:         '#374151',
    mutedFg:       '#9CA3AF',
    accent:        '#374151',
    accentFg:      '#F9FAFB',
    destructive:   '#7F1D1D',
    destructiveFg: '#F87171',
    border:        '#374151',
    inputBg:       '#374151',
    switchBg:      '#4B5563',
    ring:          '#6B7280',
    radius:        10,
  },
} as const;

// ---- Chart Colours (--chart-1 to --chart-5 from theme.css) ------------------

export const ChartColors = {
  light: {
    chart1: '#E97316',
    chart2: '#14B8A6',
    chart3: '#334155',
    chart4: '#EAB308',
    chart5: '#F59E0B',
  },
  dark: {
    chart1: '#2B6CC4',
    chart2: '#22C55E',
    chart3: '#F59E0B',
    chart4: '#F7931E',
    chart5: '#EF4444',
  },
} as const;

// ---- App Colour Tokens -------------------------------------------------------

export interface AppColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  success: string;
  successDark: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  /** Rating stars: gold, the colour people read as a rating */
  star: string;
  /** A favourite place's heart */
  heart: string;
  info: string;
  infoLight: string;
  green: string;
  greenLight: string;
  bg: string;
  surface: string;
  surfaceVariant: string;
  border: string;
  shadow: string;
  /** The soft lift under an outlined card: a faint shadow in light mode, none in dark */
  cardLift: string;
  // Shadcn-mapped extras
  muted: string;
  mutedFg: string;
  accent: string;
  inputBg: string;
  switchBg: string;
  // Text
  text: string;
  textSec: string;
  textDisabled: string;
  textOnPrimary: string;
}

export const LightColors: AppColors = {
  primary:      Palette.primary,
  primaryDark:  Palette.primaryDark,
  primaryLight: Palette.primaryLight,
  success:      Palette.success,
  successDark:  Palette.successDark,
  successLight: Palette.successLight,
  warning:      Palette.warning,
  warningLight: Palette.warningLight,
  error:        Palette.error,
  errorLight:   Palette.errorLight,
  star:         '#F5B301',
  heart:        '#E5484D',
  info:         Palette.info,
  infoLight:    Palette.infoLight,
  green:        Palette.green,
  greenLight:   Palette.greenLight,
  bg:             Palette.grey50,
  surface:        Palette.white,
  surfaceVariant: Palette.grey100,
  border:         Palette.grey200,
  shadow:         'rgba(0,0,0,0.06)',
  cardLift:       '0 6px 18px rgba(20, 24, 40, 0.08)',
  muted:    '#ECECF0',
  mutedFg:  '#717182',
  accent:   '#E9EBEF',
  inputBg:  '#F3F3F5',
  switchBg: '#CBCED4',
  text:          Palette.grey900,
  textSec:       Palette.grey500,
  textDisabled:  Palette.grey300,
  textOnPrimary: Palette.white,
};

export const DarkColors: AppColors = {
  primary:      Brand.teal,
  primaryDark:  Brand.deepTeal,
  primaryLight: '#0E3640',
  success:      '#34D399',
  successDark:  '#10B981',
  successLight: '#064E3B',
  warning:      '#FCD34D',
  warningLight: '#451A03',
  error:        '#F87171',
  errorLight:   '#450A0A',
  // A touch brighter so both stand out on dark cards
  star:         '#FFC531',
  heart:        '#FF6369',
  info:         '#60A5FA',
  infoLight:    '#1E3A5F',
  green:        '#69F0AE',
  greenLight:   '#1B5E20',
  // Navy-tinted surfaces, from the logo's background
  bg:             Brand.navyDeep,
  surface:        '#0D2631',
  surfaceVariant: '#13313D',
  border:         '#1F404D',
  shadow:         'rgba(0,0,0,0.4)',
  cardLift:       '0 0 0 0 transparent',
  muted:    '#1F404D',
  mutedFg:  '#9DB2BA',
  accent:   '#1F404D',
  inputBg:  '#13313D',
  switchBg: '#2C4F5C',
  text:          '#F5F7F8',
  textSec:       '#9DB2BA',
  textDisabled:  '#3F5B66',
  textOnPrimary: Palette.white,
};

// ---- Typography Scale --------------------------------------------------------
// CSS @layer base mapping:
//   h1 text-2xl (24px)  -> Typography['4xl'] = 24
//   h2 text-xl (20px)   -> Typography['3xl'] = 20
//   h3 text-lg (~18px)  -> Typography['2xl'] = 17
//   h4/label/button base (16px) -> Typography.xl = 16
//   input base 16px, weight 400 -> Typography.xl, Typography.regular
//   --font-weight-medium: 500   -> Typography.medium
//   --font-weight-normal: 400   -> Typography.regular
//   line-height: 1.5            -> Typography.normal

export const Typography = {
  xs:    11,
  sm:    12,
  base:  13,
  md:    14,
  lg:    15,
  xl:    16,
  '2xl': 17,
  '3xl': 20,
  '4xl': 24,
  '5xl': 26,
  '6xl': 28,
  '7xl': 32,

  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,

  tight:   1.2,
  normal:  1.5,
  relaxed: 1.6,
} as const;

// ---- Spacing Scale (Tailwind utility equivalents) ----------------------------

export const Spacing = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
  '6xl': 48,
  '7xl': 56,
  '8xl': 64,
} as const;

// ---- Border Radius (from --radius: 0.625rem = 10px + Tailwind rounded-*) ----
// --radius-sm = 6dp, --radius-md = 8dp, --radius-lg = 10dp, --radius-xl = 14dp

export const Radius = {
  xs:    6,
  sm:    8,
  md:    12,
  lg:    14,
  xl:    16,
  '2xl': 18,
  '3xl': 20,
  '4xl': 24,
  '5xl': 28,
  full:  999,
} as const;

// ---- Cross-platform Shadows --------------------------------------------------

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  primary: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  }),
} as const;

// ---- React Native Paper MD3 Theme -------------------------------------------

export const PaperLightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:            Palette.primary,
    primaryContainer:   Palette.primaryLight,
    onPrimary:          Palette.white,
    onPrimaryContainer: Palette.primaryDark,
    secondary:            Palette.success,
    secondaryContainer:   Palette.successLight,
    onSecondary:          Palette.white,
    onSecondaryContainer: Palette.successDark,
    error:          Palette.error,
    errorContainer: Palette.errorLight,
    onError:        Palette.white,
    background:      Palette.grey50,
    surface:         Palette.white,
    surfaceVariant:  '#ECECF0',
    outline:         Palette.grey200,
    outlineVariant:  '#9CA3AF',
    onBackground:    Palette.grey900,
    onSurface:       Palette.grey900,
    onSurfaceVariant: '#717182',
    scrim:           'rgba(0,0,0,0.5)',
    shadow:          '#000000',
  },
};

export const PaperDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary:            DarkColors.primary,
    primaryContainer:   DarkColors.primaryLight,
    onPrimary:          Palette.white,
    onPrimaryContainer: Palette.primaryLight,
    secondary:          '#34D399',
    secondaryContainer: '#064E3B',
    onSecondary:        Palette.white,
    onSecondaryContainer: '#D1FAE5',
    error:          '#F87171',
    errorContainer: '#450A0A',
    onError:        Palette.white,
    background:      DarkColors.bg,
    surface:         DarkColors.surface,
    surfaceVariant:  DarkColors.surfaceVariant,
    outline:         DarkColors.border,
    outlineVariant:  '#4F6E7A',
    onBackground:    DarkColors.text,
    onSurface:       DarkColors.text,
    onSurfaceVariant: DarkColors.textSec,
    scrim:           'rgba(0,0,0,0.7)',
    shadow:          '#000000',
  },
};
