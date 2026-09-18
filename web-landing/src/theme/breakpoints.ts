/**
 * Responsive breakpoints (Tailwind defaults), exposed for use in JS where
 * media queries cannot be expressed with utility classes.
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;
