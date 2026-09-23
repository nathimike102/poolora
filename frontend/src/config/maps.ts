/**
 * config/maps.ts
 *
 * Maps are drawn with MapLibre using free OpenFreeMap vector tiles built from
 * OpenStreetMap data, so no API key or billing account is needed. Point the
 * styles at another provider with MAP_STYLE_LIGHT / MAP_STYLE_DARK in .env.
 */

import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  mapsEnabled?: boolean;
  mapStyleLight?: string;
  mapStyleDark?: string;
};

/** Set MAPS_ENABLED=false in .env to show placeholders instead of maps. */
export const MAPS_ENABLED: boolean = extra.mapsEnabled !== false;

export const MAP_STYLE = {
  light: extra.mapStyleLight || 'https://tiles.openfreemap.org/styles/liberty',
  dark: extra.mapStyleDark || 'https://tiles.openfreemap.org/styles/dark',
};
