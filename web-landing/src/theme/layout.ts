/**
 * Layout tokens: container widths, horizontal gutters and z-index scale.
 */

/** Tailwind classes for the page content container, shared by every section. */
export const CONTAINER_CLASS = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';

/** Stacking order for layered UI. */
export const zIndex = {
  base: 0,
  raised: 10,
  floating: 20,
  header: 50,
} as const;
