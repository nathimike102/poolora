/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * app.config.js
 *
 * Dynamic Expo config – reads values from .env at build time.
 * Expo automatically loads .env files before evaluating this file.
 *
 * @see https://docs.expo.dev/guides/environment-variables/
 */

module.exports = {
  expo: {
    name: 'Poolora',
    slug: 'one-piece',
    version: '1.0.0',
    icon: './assets/splash.png',
    android: {
      package: 'com.poolora.app',
      adaptiveIcon: {
        foregroundImage: './assets/splash.png',
        backgroundColor: '#ffffff',
      },
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
        },
      },
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
    },
    autolinking: {
      searchPaths: ['./node_modules'],
    },
    ios: {
      bundleIdentifier: 'com.poolora.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Poolora needs your location to show your position on the map and find rides near you.',
      },
    },
    plugins: [
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-community/datetimepicker',
      '@sentry/react-native',
      'expo-splash-screen',
      'expo-status-bar',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Poolora needs your location to show your position on the map and find rides near you.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Poolora uses your photos so you can add driver verification documents and a profile picture.',
          cameraPermission: 'Poolora uses the camera so you can photograph driver verification documents.',
        },
      ],
      '@react-native-google-signin/google-signin',
      'expo-font',
      'expo-secure-store',
      '@sentry/react-native/expo',
    ],
    // Disable Over-the-Air updates in native builds to avoid remote update downloads
    // Rebuild the native app for this change to take effect.
    updates: {
      enabled: false,
      checkAutomatically: 'ON_ERROR_RECOVERY',
      // runtimeVersion can be added if using EAS updates
      // runtimeVersion: { policy: 'appVersion' },
    },
    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID ?? '',
      },
    },
    owner: 'nathi_mike',
    splash: {
      // Place your splash image at frontend/assets/splash.png (see instructions below)
      image: './assets/splash.png',
      resizeMode: 'cover',
      backgroundColor: '#ffffff',
    },
  },
};
