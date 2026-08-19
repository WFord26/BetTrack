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

  const pageCls = isDarkMode ? 'min-h-screen bg-dusk' : 'min-h-screen ds-sand-bg';
  const cardCls = isDarkMode ? 'ds-panel' : 'ds-card-ink';
  const selectCls = `w-full font-display text-[7px] tracking-[.06em] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold ${
    isDarkMode ? 'bg-dusk-panel2 text-cream border-0' : 'bg-sand-panel2 text-ink border-2 border-ink'
  }`;

  return (
    <div className={pageCls}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <p className={`font-display text-[8px] tracking-[.1em] mb-2 ${isDarkMode ? 'text-ember' : 'text-terra'}`}>
          SALOON FINDS
        </p>
        <h1
          className={`ds-headline font-display text-[19px] mb-2 ${isDarkMode ? 'text-cream' : 'text-ink'}`}
        >
          VALUE OPPORTUNITIES
        </h1>
        <p className={`font-body text-sm mb-6 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
          Games where bookmakers strongly disagree — potential market inefficiencies.
        </p>

        {/* Filters */}
        <div className={`${cardCls} p-4 mb-6`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={`block font-display text-[6px] tracking-[.1em] mb-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                MIN SCORE
              </label>
              <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className={selectCls}>
                <option value={30}>30+ (Medium)</option>
                <option value={60}>60+ (High)</option>
                <option value={81}>81+ (Extreme)</option>
              </select>
            </div>
            <div>
              <label className={`block font-display text-[6px] tracking-[.1em] mb-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                SPORT
              </label>
              <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className={selectCls}>
                <option value="all">All Sports</option>
                {sports.map((s) => (
                  <option key={s} value={s}>{sportLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block font-display text-[6px] tracking-[.1em] mb-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                TIME TO GAME
              </label>
              <select value={maxHours} onChange={(e) => setMaxHours(Number(e.target.value))} className={selectCls}>
                <option value={3}>Next 3 hours</option>
                <option value={12}>Next 12 hours</option>
                <option value={24}>Next 24 hours</option>
                <option value={48}>Next 48 hours</option>
              </select>
            </div>
            <div>
              <label className={`block font-display text-[6px] tracking-[.1em] mb-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                SORT BY
              </label>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={selectCls}>
                <option value="score">Disagreement Score</option>
                <option value="time">Time to Game</option>
                <option value="sport">Sport</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className={`font-body text-xs ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
              {filtered.length} game{filtered.length !== 1 ? 's' : ''} matching filters
            </p>
            <button
              onClick={fetchGames}
              className={`font-display text-[7px] tracking-[.06em] ${isDarkMode ? 'text-gold hover:text-ember' : 'text-terra hover:text-ember'} transition-colors`}
            >
              ↻ REFRESH
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col gap-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`h-20 animate-pulse ${isDarkMode ? 'bg-dusk-panel2' : 'bg-sand-panel border-2 border-ink'}`}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className={`p-4 ${isDarkMode ? 'bg-coral-chip border border-coral text-coral' : 'bg-sunloss-wash border-2 border-sunloss-light text-sunloss-light'}`}>
            <p className="font-body text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className={`${cardCls} p-8 text-center`}>
            <p className="text-4xl mb-3">🤝</p>
            <p className={`font-display text-[11px] mb-2 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>NO DISAGREEMENTS FOUND</p>
            <p className={`font-body text-sm ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
              Try lowering the minimum score or extending the time window.
            </p>
          </div>
        )}

        {/* Game list */}
        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-3">
            {filtered.map((game) => {
              const badge = getDisagreementBadgeColor(game.maxDisagreementScore);
              const category = getDisagreementCategory(game.maxDisagreementScore);
              const hours = hoursUntil(game.commenceTime);

              return (
                <button
                  key={game.gameId}
                  onClick={() => setSelectedGame(game)}
                  className={`w-full text-left ${cardCls} px-5 py-4 transition-all hover:brightness-105`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className={`font-body font-semibold truncate ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
                        {game.awayTeamName} <span className={isDarkMode ? 'text-cream-faint' : 'text-ink-muted'}>@</span>{' '}
                        {game.homeTeamName}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`font-display text-[6px] tracking-[.06em] px-1.5 py-0.5 ${isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-muted border border-ink'}`}>
                          {sportLabel(game.sportKey)}
                        </span>
                        <span className={`font-body text-xs ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                          {new Date(game.commenceTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className={`font-body text-xs ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                          {hours < 1 ? `${Math.round(hours * 60)}m away` : `${hours.toFixed(1)}h away`}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {game.consensus.map((c) => (
                          <span key={c.marketType} className={`font-display text-[6px] tracking-[.04em] px-2 py-0.5 ${getDisagreementBadgeColor(c.disagreementScore)}`}>
                            {c.marketType === 'h2h' ? 'ML' : c.marketType === 'spreads' ? 'SPD' : 'O/U'}{' '}{c.disagreementScore}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`font-display text-[11px] px-3 py-1 ${badge}`}>
                        {game.maxDisagreementScore}
                      </span>
                      <span className={`font-body text-xs capitalize ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
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
