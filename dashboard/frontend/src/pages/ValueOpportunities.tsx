/**
 * ValueOpportunities - Full-page view of bookmaker disagreement / value finder.
 *
 * Features:
 *  - Filter by disagreement score, sport, and time-to-game
 *  - Sort by score, time, or sport
 *  - Click any game to open the DisagreementBreakdown modal
 */
import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import {
  HighDisagreementGame,
  getDisagreementBadgeColor,
  getDisagreementCategory,
} from '../types/disagreement.types';
import DisagreementBreakdown from '../components/odds/DisagreementBreakdown';
import { useDarkMode } from '../contexts/DarkModeContext';

type SortKey = 'score' | 'time' | 'sport';

const SPORT_LABELS: Record<string, string> = {
  americanfootball_nfl: 'NFL',
  americanfootball_ncaaf: 'NCAAF',
  basketball_nba: 'NBA',
  basketball_ncaab: 'NCAAB',
  icehockey_nhl: 'NHL',
  baseball_mlb: 'MLB',
  soccer_epl: 'EPL',
  soccer_uefa_champs_league: 'UEFA CL',
};

function sportLabel(key: string): string {
  return SPORT_LABELS[key] ?? key.replace(/_/g, ' ').toUpperCase();
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

export default function ValueOpportunities() {
  const { isDarkMode } = useDarkMode();
  const [games, setGames] = useState<HighDisagreementGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<HighDisagreementGame | null>(null);

  // Filters
  const [minScore, setMinScore] = useState(60);
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [maxHours, setMaxHours] = useState<number>(48);
  const [sortKey, setSortKey] = useState<SortKey>('score');

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/analytics/disagreement/live', {
        params: { threshold: minScore, limit: 100 },
      });
      setGames(res.data.data?.games ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to fetch value opportunities');
    } finally {
      setLoading(false);
    }
  }, [minScore]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Derived data
  const sports = Array.from(new Set(games.map((g) => g.sportKey))).sort();

  const filtered = games
    .filter((g) => {
      if (sportFilter !== 'all' && g.sportKey !== sportFilter) return false;
      if (hoursUntil(g.commenceTime) > maxHours) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'score') return b.maxDisagreementScore - a.maxDisagreementScore;
      if (sortKey === 'time')
        return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
      return sportLabel(a.sportKey).localeCompare(sportLabel(b.sportKey));
    });

  const container = isDarkMode ? 'min-h-screen bg-gray-900 text-white' : 'min-h-screen bg-gray-50 text-gray-900';
  const cardBase = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputBase = isDarkMode
    ? 'bg-gray-700 border-gray-600 text-white'
    : 'bg-white border-gray-300 text-gray-900';

  return (
    <div className={container}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Value Opportunities</h1>
        <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Games where bookmakers strongly disagree — potential market inefficiencies.
        </p>

        {/* Filters */}
        <div className={`rounded-xl border p-4 mb-6 ${cardBase}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Min disagreement score */}
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Min Score
              </label>
              <select
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className={`w-full rounded-lg border px-3 py-1.5 text-sm ${inputBase}`}
              >
                <option value={30}>30+ (Medium)</option>
                <option value={60}>60+ (High)</option>
                <option value={81}>81+ (Extreme)</option>
              </select>
            </div>

            {/* Sport */}
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Sport
              </label>
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className={`w-full rounded-lg border px-3 py-1.5 text-sm ${inputBase}`}
              >
                <option value="all">All Sports</option>
                {sports.map((s) => (
                  <option key={s} value={s}>
                    {sportLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            {/* Time until game */}
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Time to Game
              </label>
              <select
                value={maxHours}
                onChange={(e) => setMaxHours(Number(e.target.value))}
                className={`w-full rounded-lg border px-3 py-1.5 text-sm ${inputBase}`}
              >
                <option value={3}>Next 3 hours</option>
                <option value={12}>Next 12 hours</option>
                <option value={24}>Next 24 hours</option>
                <option value={48}>Next 48 hours</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Sort By
              </label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className={`w-full rounded-lg border px-3 py-1.5 text-sm ${inputBase}`}
              >
                <option value="score">Disagreement Score</option>
                <option value="time">Time to Game</option>
                <option value="sport">Sport</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {filtered.length} game{filtered.length !== 1 ? 's' : ''} matching filters
            </p>
            <button
              onClick={fetchGames}
              className="text-xs text-blue-500 hover:underline"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`h-20 rounded-xl animate-pulse border ${cardBase}`}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className={`rounded-xl border p-8 text-center ${cardBase}`}>
            <p className="text-4xl mb-3">🤝</p>
            <p className="font-medium">No disagreements found</p>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Try lowering the minimum score or extending the time window.
            </p>
          </div>
        )}

        {/* Game list */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((game) => {
              const badge = getDisagreementBadgeColor(game.maxDisagreementScore);
              const category = getDisagreementCategory(game.maxDisagreementScore);
              const hours = hoursUntil(game.commenceTime);

              return (
                <button
                  key={game.gameId}
                  onClick={() => setSelectedGame(game)}
                  className={`w-full text-left rounded-xl border px-5 py-4 transition-shadow hover:shadow-md ${cardBase}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">
                        {game.awayTeamName} <span className="font-normal">@</span>{' '}
                        {game.homeTeamName}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs rounded px-1.5 py-0.5 ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                          {sportLabel(game.sportKey)}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {new Date(game.commenceTime).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {hours < 1
                            ? `${Math.round(hours * 60)}m away`
                            : `${hours.toFixed(1)}h away`}
                        </span>
                      </div>

                      {/* Market pills */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {game.consensus.map((c) => (
                          <span
                            key={c.marketType}
                            className={`text-xs rounded-full px-2 py-0.5 ${getDisagreementBadgeColor(c.disagreementScore)}`}
                          >
                            {c.marketType === 'h2h'
                              ? 'ML'
                              : c.marketType === 'spreads'
                              ? 'SPD'
                              : 'O/U'}{' '}
                            {c.disagreementScore}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`rounded-full px-3 py-1 text-sm font-bold ${badge}`}>
                        {game.maxDisagreementScore}
                      </span>
                      <span className={`text-xs capitalize ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {category}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Breakdown modal */}
      {selectedGame && (
        <DisagreementBreakdown
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
}
