/**
 * utils/dimensions.ts
 */

import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Screen width in dp (replaces 100vw) */
export const SCREEN_WIDTH = SCREEN_W;

/** Screen height in dp (replaces 100vh) */
export const SCREEN_HEIGHT = SCREEN_H;

/**
 * Convert a percentage of screen width to dp.
 * @example wp(80) // 80% of screen width
 */
export const wp = (percent: number): number =>
  (SCREEN_W * percent) / 100;

/**
 * Convert a percentage of screen height to dp.
 * @example hp(50) // 50% of screen height
 */
export const hp = (percent: number): number =>
  (SCREEN_H * percent) / 100;

/**
 * Normalise a font size based on screen width.
 * Keeps typography proportional across devices.
 * @example normalize(16) // scales 16dp proportionally
 */
export const normalize = (size: number): number => {
  const scale = SCREEN_W / 375; // 375 = iPhone SE base width
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
};

/** True for small phones (width < 360dp) */
export const isSmallScreen = SCREEN_W < 360;

/** True for large phones / small tablets (width >= 414dp) */
export const isLargeScreen = SCREEN_W >= 414;

/** True for tablets (width >= 600dp) */
export const isTablet = SCREEN_W >= 600;
