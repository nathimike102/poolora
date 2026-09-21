/**
 * config/maps.ts
 *
 * Whether this build has a Google Maps key. On Android the native Maps SDK
 * throws (and takes the whole app down) when a map mounts without one, so
 * screens check this before rendering a MapView.
 */

import Constants from 'expo-constants';

export const MAPS_ENABLED: boolean = Boolean(
  (Constants.expoConfig?.extra as { mapsEnabled?: boolean } | undefined)?.mapsEnabled,
);
