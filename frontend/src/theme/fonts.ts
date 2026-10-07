/**
 * theme/fonts.ts
 *
 * Plus Jakarta Sans, the face in the Figma designs. Each weight is its own
 * font file, and Android only applies a weight to a font built into the app,
 * so text asks for the file that matches its fontWeight (see components/Text).
 * Until the files load, or if they fail to, text keeps the phone's font.
 */

import * as Font from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_400Regular_Italic } from '@expo-google-fonts/plus-jakarta-sans/400Regular_Italic';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import type { TextStyle } from 'react-native';

const FAMILIES = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
} as const;
const ITALIC = 'PlusJakartaSans_400Regular_Italic';

/** Past this the app opens with the phone's font rather than wait */
const LOAD_TIMEOUT_MS = 3_000;

let loaded = false;

export function appFontsLoaded(): boolean {
  return loaded;
}

/** Resolves once the fonts are ready or have been given up on; never rejects. */
export async function loadAppFonts(): Promise<void> {
  const load = Font.loadAsync({
    [FAMILIES[400]]: PlusJakartaSans_400Regular,
    [FAMILIES[500]]: PlusJakartaSans_500Medium,
    [FAMILIES[600]]: PlusJakartaSans_600SemiBold,
    [FAMILIES[700]]: PlusJakartaSans_700Bold,
    [FAMILIES[800]]: PlusJakartaSans_800ExtraBold,
    [ITALIC]: PlusJakartaSans_400Regular_Italic,
  }).then(() => true, () => false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>(resolve => {
    timer = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
  });
  loaded = await Promise.race([load, timeout]);
  clearTimeout(timer);
}

type Weight = keyof typeof FAMILIES;

/** The nearest weight there is a file for: 100–400 regular, 900 extra bold */
export function appFontWeight(fontWeight: TextStyle['fontWeight']): Weight {
  if (fontWeight === 'bold') return 700;
  const n = Number(fontWeight);
  if (!Number.isFinite(n) || n <= 400) return 400;
  if (n >= 800) return 800;
  return (Math.round(n / 100) * 100) as Weight;
}

/**
 * The style that draws text in Plus Jakarta Sans at this weight. The weight
 * lives in the file, so fontWeight goes back to normal; otherwise Android
 * thickens an already bold file. Italic has a file only at regular weight;
 * heavier italics keep fontStyle and Android slants them.
 */
export function appFontStyle(weight: Weight, italic: boolean): TextStyle {
  if (italic && weight === 400) return { fontFamily: ITALIC, fontWeight: 'normal', fontStyle: 'normal' };
  return { fontFamily: FAMILIES[weight], fontWeight: 'normal' };
}

/** Paper's type scale (used by a few screens) in the same files */
export function withAppFonts<T extends { fonts: Record<string, TextStyle> }>(theme: T): T {
  if (!loaded) return theme;
  const fonts = Object.fromEntries(
    Object.entries(theme.fonts).map(([variant, style]) => [
      variant,
      { ...style, ...appFontStyle(appFontWeight(style.fontWeight), style.fontStyle === 'italic') },
    ]),
  );
  return { ...theme, fonts } as T;
}
