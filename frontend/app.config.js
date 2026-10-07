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
    name: 'Siham',
    slug: 'poolora', // the expo.dev project's name; renaming it needs a new EAS project
    version: '1.0.0',
    icon: './assets/icon.png',
    // Report the phone's light/dark setting to the app (Expo defaults to light).
    userInterfaceStyle: 'automatic',
    orientation: 'portrait',
    android: {
      package: 'com.siham.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundImage: './assets/adaptive-icon-background.png',
        backgroundColor: '#0B2530',
      },
      googleServicesFile: './google-services.json',
      // RECEIVE_BOOT_COMPLETED: expo-location hands each background position (SOS and trip
      // tracking) to a job Android keeps across restarts, and refuses that job without it,
      // crashing the app on the first position after an SOS or the start of a trip
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'RECEIVE_BOOT_COMPLETED'],
    },
    autolinking: {
      searchPaths: ['./node_modules'],
    },
    ios: {
      bundleIdentifier: 'com.siham.app',
      // Push notifications (Firebase Cloud Messaging through APNs)
      entitlements: { 'aps-environment': 'production' },
      infoPlist: {
        UIBackgroundModes: ['remote-notification'],
        NSLocationWhenInUseUsageDescription:
          'Siham needs your location to show your position on the map, find rides near you and, during an SOS, share where you are with the safety team.',
      },
    },
    plugins: [
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-firebase/messaging',
      // Small icon and colour for Android push notifications
      ['./plugins/withNotificationIcon', { icon: './assets/notification-icon.png', color: '#087F8C' }],
      '@react-native-community/datetimepicker',
      '@sentry/react-native',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 220,
          resizeMode: 'contain',
          // Brand navy, matching the in-app splash screen for a seamless handoff
          backgroundColor: '#0B2530',
        },
      ],
      'expo-status-bar',
      'expo-localization',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Siham needs your location to show your position on the map, find rides near you and, during an SOS, share where you are with the safety team.',
          // During an SOS only: keeps sending the position with the screen off,
          // as a foreground service with a visible "SOS active" notification.
          // No background-location permission is needed for this on Android.
          isAndroidForegroundServiceEnabled: true,
          isAndroidBackgroundLocationEnabled: false,
          isIosBackgroundLocationEnabled: true,
        },
      ],
      [
        'expo-audio',
        {
          // Only if the user switches on "Record audio during an SOS"
          microphonePermission: 'Siham uses the microphone during an SOS only: to record sound if you switch this on, and so the safety team can hear you if you turn on your camera.',
          recordAudioAndroid: true,
          enableBackgroundRecording: true,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Siham uses your photos so you can add driver verification documents and a profile picture.',
          cameraPermission: 'Siham uses the camera so you can photograph driver verification documents and, during an SOS, show the safety team what is happening if you choose to.',
        },
      ],
      // Maps: MapLibre with free OpenStreetMap tiles, no API key
      '@maplibre/maplibre-react-native',
      // Live video to the safety team during an SOS (UC-X04), through LiveKit
      '@livekit/react-native-expo-plugin',
      [
        '@config-plugins/react-native-webrtc',
        {
          cameraPermission: 'Siham uses the camera so you can photograph driver verification documents and, during an SOS, show the safety team what is happening if you choose to.',
          microphonePermission: 'Siham uses the microphone during an SOS only: to record sound if you switch this on, and so the safety team can hear you if you turn on your camera.',
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
      // Maps need no key. MAPS_ENABLED=false shows placeholders instead, and
      // MAP_STYLE_LIGHT / MAP_STYLE_DARK swap in another MapLibre style URL.
      mapsEnabled: process.env.MAPS_ENABLED !== 'false',
      mapStyleLight: process.env.MAP_STYLE_LIGHT ?? '',
      mapStyleDark: process.env.MAP_STYLE_DARK ?? '',
      // @nathi_mike/poolora on expo.dev. Not a secret; EAS_PROJECT_ID overrides it.
      eas: {
        projectId: process.env.EAS_PROJECT_ID || '1867e068-e5c9-4468-949a-efb9c5cb5a34',
      },
    },
    owner: 'nathi_mike',
    splash: {
      // Generated by scripts/generate_brand_assets.py
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0B2530',
    },
  },
};
