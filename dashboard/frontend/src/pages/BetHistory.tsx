import React, { useState, useEffect, useMemo } from 'react';
import BetCard from '../components/bets/BetCard';
import { Bet } from '../types/game.types';
import { useDarkMode } from '../contexts/DarkModeContext';
import { formatCurrency } from '../utils/format';
import api from '../services/api';

const STATUS_OPTIONS = ['all', 'pending', 'won', 'lost', 'push', 'cancelled'] as const;

export default function BetHistory() {
  const { isDarkMode } = useDarkMode();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const limit = 20;

  // Fetch bets
  const fetchBets = async (pageNum: number, append: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        page: pageNum,
        limit
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (sportFilter !== 'all') {
        params.sport = sportFilter;
      }
      if (startDate) {
        params.startDate = new Date(startDate).toISOString();
      }
      if (endDate) {
        params.endDate = new Date(endDate).toISOString();
      }

      const response = await api.get('/bets', { params });

      const newBets = response.data.bets || [];
      const newTotal = response.data.total || 0;

      if (append) {
        setBets((prev) => [...prev, ...newBets]);
      } else {
        setBets(newBets);
      }

      setTotal(newTotal);
      setHasMore(newBets.length === limit);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching bets:', err);
      setError(err.response?.data?.message || 'Failed to load bets');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and filter changes
  useEffect(() => {
    setPage(1);
    fetchBets(1, false);
  }, [statusFilter, sportFilter, startDate, endDate]);

  // Load more
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchBets(nextPage, true);
  };

  // Reset filters
  const handleResetFilters = () => {
    setStatusFilter('all');
    setSportFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = statusFilter !== 'all' || sportFilter !== 'all' || startDate || endDate;

  // Real stats derived from the currently loaded/filtered bets
  const stats = useMemo(() => {
    const wins = bets.filter((b) => b.status === 'won').length;
    const losses = bets.filter((b) => b.status === 'lost').length;
    const netPL = bets.reduce((sum, b) => {
      if (b.status === 'won' || b.status === 'lost' || b.status === 'push') {
        return sum + (Number(b.actualPayout ?? 0) - Number(b.stake));
      }
      return sum;
    }, 0);
    const decided = wins + losses;
    const winRate = decided > 0 ? (wins / decided) * 100 : 0;
    return { wins, losses, netPL, winRate };
  }, [bets]);

  const labelClass = isDarkMode ? 'text-cream-muted' : 'text-ink-muted';
  const chipClass = isDarkMode ? 'ds-panel px-4 py-3' : 'ds-card-ink px-4 py-3';

  return (
    <div className={`min-h-screen py-8 px-4 sm:px-6 lg:px-8 transition-colors ${isDarkMode ? 'bg-dusk' : 'bg-sand'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className={`font-display text-[8px] tracking-[.1em] mb-2 ${isDarkMode ? 'text-ember' : 'text-terra'}`}>
            THE LEDGER
          </p>
          <h1
            className={`font-display text-[17px] md:text-[19px] tracking-wide ${isDarkMode ? 'text-cream' : 'text-ink'}`}
            style={{ textShadow: isDarkMode ? '4px 4px 0 #c14d21' : '4px 4px 0 #e0a512' }}
          >
            BET HISTORY
          </h1>
          <p className={`mt-3 font-body text-sm ${isDarkMode ? 'text-cream-muted' : 'text-ink-secondary'}`}>
            View and filter your betting history
          </p>

          {/* Stat chips */}
          <div className="flex flex-wrap gap-3 mt-5">
            <div className={chipClass}>
              <p className={`font-display text-[6px] tracking-[.1em] mb-1.5 ${labelClass}`}>RECORD</p>
              <p className={`font-display text-[11px] md:text-[12px] ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
                {stats.wins}-{stats.losses}
              </p>
            </div>
            <div className={chipClass}>
              <p className={`font-display text-[6px] tracking-[.1em] mb-1.5 ${labelClass}`}>NET P&amp;L</p>
              <p
                className={`font-display text-[11px] md:text-[12px] ${
                  stats.netPL >= 0
                    ? isDarkMode ? 'text-sunwin-dark' : 'text-sunwin-light'
                    : isDarkMode ? 'text-sunloss-dark' : 'text-sunloss-light'
                }`}
              >
                {stats.netPL >= 0 ? '+' : ''}{formatCurrency(stats.netPL)}
              </p>
            </div>
            <div className={chipClass}>
              <p className={`font-display text-[6px] tracking-[.1em] mb-1.5 ${labelClass}`}>WIN RATE</p>
              <p className="font-display text-[11px] md:text-[12px] text-gold">
                {stats.winRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`${isDarkMode ? 'ds-panel' : 'ds-card-ink'} p-5 mb-6`}>
          {/* Status chips */}
          <div className="mb-4">
            <p className={`font-display text-[6px] tracking-[.1em] mb-2 ${labelClass}`}>STATUS</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`font-display text-[7px] px-3 py-2 tracking-[.06em] transition-colors ${
                    statusFilter === s
                      ? isDarkMode ? 'bg-gold text-dusk' : 'bg-terra text-terra-text'
                      : isDarkMode ? 'bg-dusk-panel text-cream-muted' : 'bg-sand-panel text-ink-secondary'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sport Filter */}
            <div>
              <label htmlFor="sport-filter" className={`block font-display text-[6px] tracking-[.1em] mb-2 ${labelClass}`}>
                SPORT
              </label>
              <select
                id="sport-filter"
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className={`w-full px-3 py-2 font-body text-sm focus:outline-none transition-colors ${
                  isDarkMode
                    ? 'bg-dusk-panel2 text-cream border-2 border-dusk-panel2 focus:border-gold'
                    : 'bg-sand-panel2 text-ink border-2 border-ink focus:border-terra'
                }`}
              >
                <option value="all">All Sports</option>
                <option value="basketball_nba">NBA</option>
                <option value="americanfootball_nfl">NFL</option>
                <option value="icehockey_nhl">NHL</option>
                <option value="baseball_mlb">MLB</option>
                <option value="americanfootball_ncaaf">NCAAF</option>
                <option value="basketball_ncaab">NCAAB</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label htmlFor="start-date" className={`block font-display text-[6px] tracking-[.1em] mb-2 ${labelClass}`}>
                START DATE
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-3 py-2 font-body text-sm focus:outline-none transition-colors ${
                  isDarkMode
                    ? 'bg-dusk-panel2 text-cream border-2 border-dusk-panel2 focus:border-gold'
                    : 'bg-sand-panel2 text-ink border-2 border-ink focus:border-terra'
                }`}
              />
            </div>

            {/* End Date */}
            <div>
              <label htmlFor="end-date" className={`block font-display text-[6px] tracking-[.1em] mb-2 ${labelClass}`}>
                END DATE
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-3 py-2 font-body text-sm focus:outline-none transition-colors ${
                  isDarkMode
                    ? 'bg-dusk-panel2 text-cream border-2 border-dusk-panel2 focus:border-gold'
                    : 'bg-sand-panel2 text-ink border-2 border-ink focus:border-terra'
                }`}
              />
            </div>
          </div>

          {/* Filter Actions */}
          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between">
              <p className={`font-body text-sm ${isDarkMode ? 'text-cream-muted' : 'text-ink-secondary'}`}>
                Showing {bets.length} of {total} bets
              </p>
              <button
                onClick={handleResetFilters}
                className={`font-display text-[7px] tracking-[.06em] ${
                  isDarkMode ? 'text-ember hover:text-gold' : 'text-terra hover:text-ember'
                }`}
              >
                RESET FILTERS
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && bets.length === 0 && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="ds-sand-bg animate-pulse"
                style={{
                  height: '110px',
                  ...(isDarkMode
                    ? { boxShadow: '0 8px 0 #120a22' }
                    : { border: '3px solid #3a2413', boxShadow: '6px 6px 0 #d8c19a' })
                }}
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className={`${isDarkMode ? 'ds-panel' : 'ds-card-ink'} p-5 text-center`}>
            <p className={`font-body text-sm ${isDarkMode ? 'text-sunloss-dark' : 'text-sunloss-light'}`}>{error}</p>
            <button
              onClick={() => fetchBets(1, false)}
              className={`mt-3 px-4 py-2 font-display text-[10px] ${isDarkMode ? 'ds-btn-press' : 'ds-btn-press-light'}`}
            >
              RETRY
            </button>
          </div>
        )}

        {/* Bet List */}
        {!loading && !error && bets.length > 0 && (
          <>
            <div className="flex flex-col gap-4 mb-6">
              {bets.map((bet) => (
                <BetCard key={bet.id} bet={bet} />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className={`px-6 py-3 font-display text-[10px] disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDarkMode ? 'ds-btn-press' : 'ds-btn-press-light'
                  }`}
                >
                  {loading ? 'LOADING...' : 'LOAD MORE'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && !error && bets.length === 0 && (
          <div className={`${isDarkMode ? 'ds-panel' : 'ds-card-ink'} p-12 text-center`}>
            <svg
              className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-ember' : 'text-terra'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3
              className={`font-display text-[13px] tracking-wide mb-3 ${isDarkMode ? 'text-cream' : 'text-ink'}`}
              style={{ textShadow: isDarkMode ? '3px 3px 0 #c14d21' : '3px 3px 0 #e0a512' }}
            >
              NO BETS FOUND
            </h3>
            <p className={`font-body text-sm mb-4 ${isDarkMode ? 'text-cream-muted' : 'text-ink-secondary'}`}>
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results'
                : "The ledger's empty. Add your first bet to get rolling."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className={`px-4 py-2 font-display text-[10px] ${isDarkMode ? 'ds-btn-press' : 'ds-btn-press-light'}`}
              >
                CLEAR FILTERS
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
