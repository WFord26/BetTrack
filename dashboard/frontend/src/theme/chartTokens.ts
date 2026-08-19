/**
 * Chart color tokens.
 *
 * Recharts styles its axes, grids, tooltips, and series through JS props
 * (`stroke`, `fill`, `contentStyle`), so those colors cannot be expressed as
 * Tailwind utility classes. This module is the single place they are allowed
 * to be literal values — everywhere else, use the tokens in tailwind.config.js.
 *
 * Every value here mirrors a token in tailwind.config.js. The mapping is
 * enforced by chartTokens.test.ts, which reads the config and fails if the two
 * drift apart, so retinting the palette stays a config-only change.
 */

/** Chrome around a chart: grid lines, axes, tick labels, tooltip surface. */
export const chartChrome = {
  /** surface-700 — grid lines and the tooltip border */
  grid: '#374151',
  /** surface-400 — axis lines, tick labels, legend text */
  axis: '#9ca3af',
  /** surface-800 — tooltip background */
  tooltipBg: '#1f2937',
  /** surface-100 — tooltip text */
  tooltipText: '#f3f4f6',
} as const;

/** Data series colors. */
export const chartSeries = {
  /** brand-600 — the primary (single-series) data color */
  primary: '#dc2626',
} as const;

/** Tailwind token path for each value above, checked by chartTokens.test.ts. */
export const chartTokenSources = {
  'chartChrome.grid': 'surface.700',
  'chartChrome.axis': 'surface.400',
  'chartChrome.tooltipBg': 'surface.800',
  'chartChrome.tooltipText': 'surface.100',
  'chartSeries.primary': 'brand.600',
} as const;
