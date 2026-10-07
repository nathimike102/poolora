/**
 * Brand and literal color tokens.
 *
 * Tailwind utility colors (`bg-brand`, `text-brand`, …) are registered in
 * `src/styles/theme.css`. These TypeScript tokens mirror the same values for
 * use in contexts Tailwind cannot reach: inline `style` props, SVG gradient
 * stops, and canvas/JS color calculations.
 */
export const colors = {
  /** Primary brand teal; passes AA contrast with white text. */
  brand: '#087F8C',
  /** Hover / pressed state, and the logo's deep teal. */
  brandDark: '#056981',
  /** The logo's bright teal. Accents and dark backgrounds only (fails contrast on white). */
  brandCyan: '#0AA2A8',
  /** Aqua highlight for dark sections. */
  aqua: '#35D0BA',

  /** Brand navy: structure, dark sections and the wordmark on light backgrounds. */
  navy: '#0B2530',
  /** Deepest navy, used by the footer. */
  ink: '#061A22',
  /** Warm ivory from the logo: the wordmark on dark, and warm section backgrounds. */
  ivory: '#F5F1E7',

  /** Device mockup surfaces (Hero phone). */
  deviceBody: '#111',
  deviceBezel: '#222',
  deviceScreen: '#F7F8FC',

  /** Dot-grid background texture. */
  dotGrid: '#d1d5db',

  white: '#ffffff',
} as const;

export type ColorToken = keyof typeof colors;
