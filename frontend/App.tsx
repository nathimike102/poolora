/**
 * App.tsx
 *
 * Root app bootstrap and providers.
 */

// Polyfill Buffer for libs that import 'buffer' (e.g., react-native-svg)
import { Buffer } from 'buffer';
declare const global: any;
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Reanimated (and some animation helpers) expect a global helper
// `global._getAnimationTimestamp`. Ensure it's defined early so
// animated hooks like `useSharedValue` work reliably in dev builds.
if (typeof global._getAnimationTimestamp !== 'function') {
  const now =
    typeof global.performance === 'object' && typeof global.performance.now === 'function'
      ? () => global.performance.now()
      : () => Date.now();
  global._getAnimationTimestamp = now;
}

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Platform, UIManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { AppProvider } from './src/context/AppContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { PaperLightTheme, PaperDarkTheme } from './src/theme';
import { useIsDark } from './src/theme/themed';
import { loadAppFonts, withAppFonts } from './src/theme/fonts';
import { setupAllInterceptors } from './src/api/interceptors';
import { logger } from './src/utils/logger';
import { initErrorTracking } from './src/config/errorTracking';
// Defines the SOS background location task, which must exist before the system wakes the app for it
import './src/services/sosTracking';
import './src/services/tripTracking';
import { restoreLanguage } from './src/i18n';

initErrorTracking();

// ─── Inner app — needs AppProvider to already be mounted ──────────────────────
// Re-renders for a theme change (status bar, Paper's theme) but hands the same
// navigator element down each time, so the screens below don't re-render:
// their colours repaint natively (theme/themed).

function ThemedApp() {
  const isDarkMode = useIsDark();
  // Screens wait for the font (a moment, from the app's own files) so text
  // doesn't jump from the phone's font to the app's
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    loadAppFonts().then(() => setFontsReady(true));
  }, []);
  const paperTheme = useMemo(
    () => withAppFonts(isDarkMode ? PaperDarkTheme : PaperLightTheme),
    // fontsReady: the fonts apply once loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDarkMode, fontsReady],
  );
  const screens = useMemo(
    () => (
      <ErrorBoundary>
        <AppNavigator />
      </ErrorBoundary>
    ),
    [],
  );
  if (!fontsReady) return null;

  return (
    <PaperProvider theme={paperTheme}>
      {/* Screens draw light headers edge to edge, so icons follow the theme */}
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {screens}
    </PaperProvider>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function App() {
  // Initialize API client on app startup
  useEffect(() => {
    try {
      setupAllInterceptors();
      logger.info('API client initialized with interceptors');
    } catch (error) {
      logger.error('Failed to initialize API client', { error });
    }
    // The language chosen in Settings (UC-X03); until it loads, the phone's
    restoreLanguage();
  }, []);

  return (
    // GestureHandlerRootView: MUST be root for gesture-handler to work
    <GestureHandlerRootView style={styles.root}>
      {/* SafeAreaProvider: makes useSafeAreaInsets available globally */}
      <SafeAreaProvider>
        {/* AppProvider: global role, user, theme state */}
        <AppProvider>
          {/* ThemedApp: follows the theme for the status bar and Paper */}
          <ThemedApp />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
