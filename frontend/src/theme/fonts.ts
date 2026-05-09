/**
 * theme/fonts.ts
 *
 * Font-family constants and loading helpers for the Inter typeface.
 * Uses @expo-google-fonts/inter loaded via useFonts() in App.tsx.
 */

// ---- Install command (run in terminal) --------------------------------------
// npx expo install @expo-google-fonts/inter expo-font expo-splash-screen

// ---- Usage in App.tsx -------------------------------------------------------
/*
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_400Regular_Italic,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useCallback } from 'react';
import { View } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_400Regular_Italic,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // Keep splash screen visible
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      ... rest of providers
    </GestureHandlerRootView>
  );
}
*/

// ---- Font name constants (use in StyleSheet.create fontFamily prop) ----------

export const FontFamily = {
  regular:   'Inter_400Regular',
  italic:    'Inter_400Regular_Italic',
  medium:    'Inter_500Medium',
  semiBold:  'Inter_600SemiBold',
  bold:      'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',

  // System font fallbacks (used before fonts load or if expo-font not installed)
  // iOS uses SF Pro, Android uses Roboto — both visually similar to Inter
  system:    undefined as undefined,
} as const;

// ---- Font weight to family mapping ------------------------------------------
// Use this to pick the correct Inter variant for a given fontWeight.
// Ensures the correct font file is used rather than relying on OS synthesis.

export function getFontFamily(weight: '400' | '500' | '600' | '700' | '800'): string {
  switch (weight) {
    case '400': return FontFamily.regular;
    case '500': return FontFamily.medium;
    case '600': return FontFamily.semiBold;
    case '700': return FontFamily.bold;
    case '800': return FontFamily.extraBold;
    default:    return FontFamily.regular;
  }
}
