import React, { useState, useEffect } from 'react';
import BetCard from '../components/bets/BetCard';
import { Bet } from '../types/game.types';
import api from '../services/api';

export default function BetHistory() {
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bet History</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View and filter your betting history
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="push">Push</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Sport Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sport
              </label>
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter Actions */}
          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {bets.length} of {total} bets
              </p>
              <button
                onClick={handleResetFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && bets.length === 0 && (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => fetchBets(1, false)}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Bet List */}
        {!loading && !error && bets.length > 0 && (
          <>
            <div className="grid gap-4 mb-6">
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
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && !error && bets.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🎟️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Bets Found
            </h3>
            <p className="text-gray-600 mb-4">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results'
                : 'You haven\'t placed any bets yet'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
