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
    name: 'RidePool',
    slug: 'one-piece',
    android: {
      package: 'com.ridepool.app',
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
        },
      },
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
    },
    ios: {
      bundleIdentifier: 'com.ridepool.app',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'RidePool needs your location to show your position on the map and find rides near you.',
      },
    },
    plugins: [
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'RidePool needs your location to show your position on the map and find rides near you.',
        },
      ],
      '@react-native-google-signin/google-signin',
      'expo-font',
      'expo-secure-store',
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
  },
};
