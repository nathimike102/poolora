/**
 * Animation timing tokens (seconds for `motion`, milliseconds for CSS).
 *
 * Values mirror the durations already used across the UI so existing
 * animations remain pixel-for-pixel identical.
 */

/** `motion` durations, in seconds. */
export const motionDuration = {
  fast: 0.2,
  base: 0.3,
  reveal: 0.65,
  hero: 0.9,
} as const;

/** Float loop durations for the Hero's drifting cards, in seconds. */
export const floatDuration = {
  a: 4.5,
  b: 5.5,
  c: 3.8,
} as const;

/** Tailwind `duration-*` values used by CSS transitions, in milliseconds. */
export const transitionMs = {
  fast: 150,
  base: 200,
  slow: 300,
} as const;

/** Shared "ease-out expo" curve for entrance animations. */
export const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;
