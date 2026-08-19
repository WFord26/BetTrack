/**
 * Guards the one place chart colors are duplicated outside tailwind.config.js.
 *
 * Recharts needs real color values in JS props, so chartTokens.ts restates a
 * handful of palette entries. These tests read the actual Tailwind config and
 * fail if a token is renamed, retinted, or removed — so the duplication can
 * never silently drift out of sync with the design system.
 */
import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../tailwind.config.js';
import { chartChrome, chartSeries, chartTokenSources } from './chartTokens';

const colors = (tailwindConfig as any).theme.extend.colors as Record<string, any>;

/** Resolve a dotted Tailwind color path, e.g. 'surface.700' → '#374151'. */
function resolveToken(path: string): unknown {
  return path.split('.').reduce<any>((node, key) => node?.[key], colors);
}

/** Resolve a dotted path within the exported chart tokens. */
function resolveChartToken(path: string): unknown {
  const [group, key] = path.split('.');
  const groups: Record<string, Record<string, string>> = { chartChrome, chartSeries };
  return groups[group]?.[key];
}

describe('chartTokens', () => {
  it.each(Object.entries(chartTokenSources))(
    '%s matches the %s Tailwind token',
    (chartPath, tokenPath) => {
      const configured = resolveToken(tokenPath);
      expect(configured, `tailwind.config.js has no color at "${tokenPath}"`).toBeDefined();
      expect(resolveChartToken(chartPath)).toBe(configured);
    }
  );

  it('declares a source token for every exported chart color', () => {
    const exported = [
      ...Object.keys(chartChrome).map((k) => `chartChrome.${k}`),
      ...Object.keys(chartSeries).map((k) => `chartSeries.${k}`),
    ];
    expect(exported.sort()).toEqual(Object.keys(chartTokenSources).sort());
  });
});
