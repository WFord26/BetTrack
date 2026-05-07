/**
 * DisagreementBreakdown - Modal showing full consensus detail for a game.
 *
 * Displays:
 *  - All bookmaker lines per market type
 *  - Consensus line and standard deviation
 *  - Outlier bookmakers highlighted
 *  - Best value indicator
 */
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import {
  ConsensusResult,
  HighDisagreementGame,
  getDisagreementBadgeColor,
  getDisagreementCategory,
} from '../../types/disagreement.types';
import { useDarkMode } from '../../contexts/DarkModeContext';

interface Props {
  game: HighDisagreementGame | null;
  onClose: () => void;
}

const MARKET_LABELS: Record<string, string> = {
  h2h: 'Moneyline',
  spreads: 'Spread',
  totals: 'Total (O/U)',
};

function formatLine(marketType: string, line: number): string {
  if (marketType === 'h2h') {
    return line >= 0 ? `+${line}` : `${line}`;
  }
  if (marketType === 'spreads') {
    return line >= 0 ? `+${line.toFixed(1)}` : `${line.toFixed(1)}`;
  }
  return line.toFixed(1);
}

export default function DisagreementBreakdown({ game, onClose }: Props) {
  const { isDarkMode } = useDarkMode();
  const [consensus, setConsensus] = useState<ConsensusResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!game) return;

    // Use the consensus data already loaded in the parent, supplemented
    // by a fresh fetch if needed.
    if (game.consensus?.length > 0) {
      setConsensus(game.consensus);
    } else {
      setLoading(true);
      api
        .get(`/analytics/disagreement/game/${game.gameId}`)
        .then((res) => {
          setConsensus(res.data.data ?? []);
        })
        .catch((err) => {
          setError(err.response?.data?.error ?? 'Failed to load breakdown');
        })
        .finally(() => setLoading(false));
    }
  }, [game]);

  if (!game) return null;

  const overlayClass = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4';
  const panelClass = `relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl ${
    isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
  }`;

  return (
    <div className={overlayClass} onClick={onClose}>
      <div className={panelClass} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`sticky top-0 px-6 py-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-white'}`}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
          <h2 className="text-lg font-bold pr-8">
            {game.awayTeamName} <span className="font-normal text-sm">@</span> {game.homeTeamName}
          </h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {new Date(game.commenceTime).toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            {' · '}
            <span className="uppercase tracking-wide">{game.sportKey}</span>
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          {loading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`h-20 rounded-lg animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}
                />
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {!loading &&
            !error &&
            consensus.map((c) => {
              const badgeColor = getDisagreementBadgeColor(c.disagreementScore);
              const category = getDisagreementCategory(c.disagreementScore);
              const outlierKeys = new Set(c.outlierBookmakers.map((o) => o.bookmaker));

              return (
                <div
                  key={c.marketType}
                  className={`rounded-xl border p-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
                >
                  {/* Market header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">
                      {MARKET_LABELS[c.marketType] ?? c.marketType}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {c.bookmakerCount} books · σ {c.standardDeviation}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                        {c.disagreementScore} · {category}
                      </span>
                    </div>
                  </div>

                  {/* Consensus line */}
                  <div className={`flex items-center gap-2 mb-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className="font-medium">Consensus:</span>
                    <span>{formatLine(c.marketType, c.consensusLine)}</span>
                  </div>

                  {/* Outliers */}
                  {c.outlierBookmakers.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-orange-500 mb-1">⚠ Outliers</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.outlierBookmakers.map((o) => (
                          <span
                            key={o.bookmaker}
                            className="rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 text-xs"
                          >
                            {o.bookmaker}: {formatLine(c.marketType, o.line)} ({o.deviation > 0 ? '+' : ''}{o.deviation}σ)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Best value */}
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${isDarkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-50 text-green-800'}`}>
                    <span>✅</span>
                    <span>
                      <span className="font-medium">Best value:</span>{' '}
                      {c.bestValue.side.toUpperCase()} at{' '}
                      <span className="font-semibold">{c.bestValue.bookmaker}</span>{' '}
                      ({formatLine(c.marketType, c.bestValue.line)}, {(c.bestValue.impliedProb * 100).toFixed(1)}% implied)
                    </span>
                  </div>
                </div>
              );
            })}

          {!loading && !error && consensus.length === 0 && (
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No consensus data available for this game yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
