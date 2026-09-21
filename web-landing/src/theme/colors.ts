/**
 * Brand and literal color tokens.
 *
 * Tailwind utility colors (`bg-brand`, `text-brand`, …) are registered in
 * `src/styles/theme.css`. These TypeScript tokens mirror the same values for
 * use in contexts Tailwind cannot reach: inline `style` props, SVG gradient
 * stops, and canvas/JS color calculations.
 */
export const colors = {
  /** Primary brand teal, taken from the Poolora logo. */
  brand: '#0B7A75',
  /** Hover / pressed state for the brand teal. */
  brandDark: '#08605C',
  /** Secondary brand blue, from the logo's road arc. */
  brandCyan: '#2B6CC4',

  /** Near-black background used by the footer. */
  ink: '#080810',

  /** Device mockup surfaces (Hero phone). */
  deviceBody: '#111',
  deviceBezel: '#222',
  deviceScreen: '#F7F8FC',

  /** Dot-grid background texture. */
  dotGrid: '#d1d5db',

  white: '#ffffff',
} as const;

export type ColorToken = keyof typeof colors;
