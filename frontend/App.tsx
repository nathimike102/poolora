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

import React, { useEffect } from 'react';
import { StyleSheet, Platform, UIManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { AppProvider, useApp } from './src/context/AppContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { PaperLightTheme, PaperDarkTheme } from './src/theme';
import { setupAllInterceptors } from './src/api/interceptors';
import { logger } from './src/utils/logger';

// ─── Inner app — needs AppProvider to already be mounted ──────────────────────
// We split this out so we can read isDarkMode from context to pick the theme.

function ThemedApp() {
  const { isDarkMode } = useApp();
  const paperTheme = isDarkMode ? PaperDarkTheme : PaperLightTheme;

  return (
    <PaperProvider theme={paperTheme}>
      <ErrorBoundary>
        <AppNavigator />
      </ErrorBoundary>
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
  }, []);

  return (
    // GestureHandlerRootView: MUST be root for gesture-handler to work
    <GestureHandlerRootView style={styles.root}>
      {/* SafeAreaProvider: makes useSafeAreaInsets available globally */}
      <SafeAreaProvider>
        {/* AppProvider: global role, user, theme state */}
        <AppProvider>
          {/* ThemedApp: reads isDarkMode → selects Paper MD3 theme */}
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
