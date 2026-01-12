import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { usePreferences } from '../contexts/PreferencesContext';
import { formatOdds } from '../utils/format';
import { addFutureLeg } from '../store/betSlipSlice';

interface Outcome {
  outcome: string;
  bookmakers: Array<{
    bookmaker: string;
    price: number;
  }>;
  bestOdds: number;
}

interface Future {
  id: string;
  title: string;
  description?: string;
  status: string;
  sport: {
    key: string;
    name: string;
  };
  groupedOutcomes: Outcome[];
}

export default function Futures() {
  const { useDecimalOdds } = usePreferences();
  const dispatch = useDispatch();
  const [futures, setFutures] = useState<Future[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>('all');

  useEffect(() => {
    fetchFutures();
  }, [selectedSport]);

  const fetchFutures = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (selectedSport !== 'all') {
        params.append('sportKey', selectedSport);
      }

      const response = await fetch(`http://localhost:3001/api/futures?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch futures');
      }

      const data = await response.json();
      setFutures(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/admin/sync-futures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sportKey: selectedSport === 'all' ? null : selectedSport })
      });

      if (response.ok) {
        // Wait a few seconds for sync to complete, then refresh
        setTimeout(() => fetchFutures(), 3000);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  const handleAddToBetSlip = (future: Future, outcome: Outcome) => {
    dispatch(addFutureLeg({
      futureId: future.id,
      futureTitle: future.title,
      outcome: outcome.outcome,
      odds: outcome.bestOdds,
      status: 'pending',
      sportKey: future.sport.key
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading futures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              🏆 Futures Betting
            </h1>
            <button
              onClick={handleSync}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Odds
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Bet on championship winners, division titles, MVP awards, and more
          </p>

          {/* Sport Filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'americanfootball_nfl', 'basketball_nba', 'icehockey_nhl', 'baseball_mlb'].map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedSport === sport
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {sport === 'all' ? 'All Sports' : sport.split('_').pop()?.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && futures.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Futures Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Click "Sync Odds" to fetch the latest futures betting markets
            </p>
          </div>
        )}

        {/* Futures List */}
        <div className="space-y-6">
          {futures.map((future) => (
            <div key={future.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              {/* Future Header */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white">{future.title}</h2>
                <p className="text-purple-100 text-sm">{future.sport.name}</p>
              </div>

              {/* Outcomes Grid */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {future.groupedOutcomes
                    .sort((a, b) => b.bestOdds - a.bestOdds) // Sort by best odds (favorites first)
                    .map((outcome, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white flex-1">
                          {outcome.outcome}
                        </h3>
                        <div className="ml-2">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {formatOdds(outcome.bestOdds, useDecimalOdds)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                            Best Odds
                          </div>
                        </div>
                      </div>

                      {/* Bookmaker Odds */}
                      <div className="space-y-1 pt-3 border-t border-gray-100 dark:border-gray-700 mb-3">
                        {outcome.bookmakers.slice(0, 3).map((bookmaker, bidx) => (
                          <div key={bidx} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400 capitalize">
                              {bookmaker.bookmaker.replace(/_/g, ' ')}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatOdds(bookmaker.price, useDecimalOdds)}
                            </span>
                          </div>
                        ))}
                        {outcome.bookmakers.length > 3 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                            +{outcome.bookmakers.length - 3} more books
                          </div>
                        )}
                      </div>

                      {/* Add to Bet Slip Button */}
                      <button
                        onClick={() => handleAddToBetSlip(future, outcome)}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add to Bet Slip
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
