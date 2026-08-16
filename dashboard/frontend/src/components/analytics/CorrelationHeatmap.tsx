/**
 * Correlation Heatmap
 *
 * Reference matrix of correlation strength by selection-type combination,
 * mirroring the backend's detection rules (`correlation.service.ts`):
 *   - same-game:   spread + total, same game            → 0.85
 *   - derivative:  moneyline + spread, same side, |line| <= 3 → 0.90
 *   - inverse:     moneyline + moneyline, opposite sides → -1.00
 * Temporal correlation depends on team/schedule rather than selection type,
 * so it isn't part of this grid — see the Education tab for that one.
 */

import React from 'react';

interface Cell {
  row: string;
  col: string;
  score: number | null;
  label: string;
}

const TYPES = ['moneyline', 'spread', 'total'] as const;

const RULES: Record<string, { score: number; label: string }> = {
  'moneyline+moneyline': { score: -1.0, label: 'Inverse — mutually exclusive (opposite sides)' },
  'moneyline+spread': { score: 0.9, label: 'Derivative — same side, small spread (≤3)' },
  'spread+total': { score: 0.85, label: 'Same-game — team performance drives both' },
  'moneyline+total': { score: 0, label: 'Independent' },
  'spread+spread': { score: 0, label: 'Independent (different games) / priced as SGP (same game)' },
  'total+total': { score: 0, label: 'Independent (different games) / priced as SGP (same game)' },
};

function ruleFor(a: string, b: string) {
  const key = [a, b].sort().join('+');
  return RULES[key] ?? { score: 0, label: 'Independent' };
}

function scoreColor(score: number, isDarkMode: boolean): string {
  if (score <= -0.6) return isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800';
  if (score >= 0.6) return isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800';
  if (Math.abs(score) >= 0.3) return isDarkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800';
  return isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800';
}

export default function CorrelationHeatmap({ isDarkMode }: { isDarkMode: boolean }) {
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const cellBorder = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  const cells: Cell[][] = TYPES.map((row) =>
    TYPES.map((col) => {
      const rule = ruleFor(row, col);
      return { row, col, score: rule.score, label: rule.label };
    })
  );

  const [active, setActive] = React.useState<Cell | null>(null);

  return (
    <div className={`rounded-lg border p-5 ${cardBg}`}>
      <h2 className={`text-lg font-semibold mb-1 ${textPrimary}`}>Correlation Heatmap</h2>
      <p className={`text-xs mb-4 ${textSecondary}`}>
        Same-game correlation strength by selection type. Hover a cell for details.
      </p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className={`p-2 text-left ${textSecondary}`}></th>
            {TYPES.map((t) => (
              <th key={t} className={`p-2 text-center font-medium capitalize ${textSecondary}`}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, i) => (
            <tr key={TYPES[i]}>
              <th className={`p-2 text-left font-medium capitalize ${textSecondary}`}>{TYPES[i]}</th>
              {row.map((cell) => (
                <td
                  key={cell.col}
                  className={`p-2 border ${cellBorder} text-center`}
                  onMouseEnter={() => setActive(cell)}
                  onMouseLeave={() => setActive((prev) => (prev === cell ? null : prev))}
                >
                  <span
                    className={`inline-block w-full rounded px-2 py-1.5 font-semibold cursor-default ${scoreColor(
                      cell.score ?? 0,
                      isDarkMode
                    )}`}
                  >
                    {cell.score! > 0 ? '+' : ''}
                    {cell.score!.toFixed(2)}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className={`mt-4 min-h-[2.5rem] text-sm ${textSecondary}`}>
        {active ? (
          <p>
            <span className={`font-medium ${textPrimary}`}>
              {active.row} + {active.col}:
            </span>{' '}
            {active.label}
          </p>
        ) : (
          <p>Same-side moneyline + small spread pairs are the strongest correlation (derivative pricing).</p>
        )}
      </div>
    </div>
  );
}
