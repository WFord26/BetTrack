import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { usePreferences } from '../contexts/PreferencesContext';
import { useDarkMode } from '../contexts/DarkModeContext';
import { formatOdds } from '../utils/format';
import { addFutureLeg } from '../store/betSlipSlice';
import apiClient from '../services/api';

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
  const { isDarkMode } = useDarkMode();
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

      const { data } = await apiClient.get(`/futures?${params}`);
      setFutures(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      await apiClient.post('/admin/sync-futures', {
        sportKey: selectedSport === 'all' ? null : selectedSport
      });
      setTimeout(() => fetchFutures(), 3000);
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
      <div className="min-h-screen bg-sand dark:bg-dusk flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
          <p className="font-display text-[8px] text-ink-muted dark:text-cream-muted tracking-[.1em]">LOADING FUTURES...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand dark:bg-dusk py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/decorations/horseshoe.png"
                alt=""
                width={52}
                height={52}
                style={{ imageRendering: 'pixelated' }}
                className="hidden sm:block"
              />
              <div>
                <p className="font-display text-[8px] text-ember tracking-[.1em] mb-3">LONG RIDES</p>
                <h1
                  className="font-display text-[19px] text-ink dark:text-cream"
                  style={{ textShadow: isDarkMode ? '4px 4px 0 #c14d21' : '4px 4px 0 #e0a512' }}
                >
                  FUTURES
                </h1>
              </div>
            </div>
            <button
              onClick={handleSync}
              className="ds-btn-press px-4 py-2.5 text-[7.5px] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              SYNC ODDS
            </button>
          </div>
          <p className="font-body text-ink-muted dark:text-cream-muted mb-4">
            Bet on championship winners, division titles, MVP awards, and more
          </p>

          {/* Sport Filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'americanfootball_nfl', 'basketball_nba', 'icehockey_nhl', 'baseball_mlb'].map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={`font-display text-[7.5px] px-[13px] py-2.5 tracking-[.05em] transition-transform ${
                  selectedSport === sport
                    ? 'bg-gold text-dusk shadow-[0_3px_0_#8a5a10]'
                    : 'bg-dusk-panel text-cream-muted hover:opacity-90'
                }`}
              >
                {sport === 'all' ? 'ALL SPORTS' : sport.split('_').pop()?.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-terra/10 border-2 border-terra rounded-lg p-4 mb-6">
            <p className="font-body text-terra dark:text-terra-muted">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && futures.length === 0 && (
          <div className="ds-panel-lg rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="font-display text-[12px] text-cream mb-3">
              NO FUTURES AVAILABLE
            </h3>
            <p className="font-body text-cream-muted mb-4">
              Click "Sync Odds" to fetch the latest futures betting markets
            </p>
          </div>
        )}

        {/* Futures List */}
        <div className="space-y-6">
          {futures.map((future) => (
            <div key={future.id} className="ds-panel-lg rounded-lg overflow-hidden">
              {/* Future Header */}
              <div
                style={{ padding: '16px 20px', background: 'linear-gradient(90deg,#c14d21,#6d4a9e)' }}
              >
                <h2
                  className="font-display text-[12px] text-terra-text"
                  style={{ textShadow: '2px 2px 0 #120a22' }}
                >
                  {future.title}
                </h2>
                <p className="font-body text-[13px] text-terra-muted mt-1.5">
                  {future.sport.name} &middot; {future.groupedOutcomes.length} outcome{future.groupedOutcomes.length === 1 ? '' : 's'}
                </p>
              </div>

              {/* Outcomes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
                {future.groupedOutcomes
                  .slice()
                  .sort((a, b) => b.bestOdds - a.bestOdds) // Sort by best odds (favorites first)
                  .map((outcome, idx) => (
                  <div key={idx} className="bg-dusk-panel2 p-4 rounded">
                    <div className="flex gap-2.5 items-start">
                      <h3 className="font-body text-[15px] font-bold text-cream flex-1">
                        {outcome.outcome}
                      </h3>
                      <div className="text-right">
                        <div
                          className="font-display text-[14px] text-gold"
                          style={{ textShadow: '2px 2px 0 #120a22' }}
                        >
                          {formatOdds(outcome.bestOdds, useDecimalOdds)}
                        </div>
                        <div className="font-display text-[5.5px] text-cream-faint tracking-[.1em] mt-1.5">
                          BEST ODDS
                        </div>
                      </div>
                    </div>

                    {/* Bookmaker Odds */}
                    <div className="flex flex-col gap-1.5 mt-3 pt-2.5 border-t-2 border-dusk-ring">
                      {outcome.bookmakers.slice(0, 3).map((bookmaker, bidx) => (
                        <div key={bidx} className="flex justify-between font-body text-[12.5px]">
                          <span className="text-cream-muted capitalize">
                            {bookmaker.bookmaker.replace(/_/g, ' ')}
                          </span>
                          <span className="text-cream font-semibold">
                            {formatOdds(bookmaker.price, useDecimalOdds)}
                          </span>
                        </div>
                      ))}
                      {outcome.bookmakers.length > 3 && (
                        <div className="font-body text-[11px] text-cream-faint pt-1">
                          +{outcome.bookmakers.length - 3} more books
                        </div>
                      )}
                    </div>

                    {/* Add to Bet Slip Button */}
                    <button
                      onClick={() => handleAddToBetSlip(future, outcome)}
                      className="ds-btn-press mt-3 w-full font-display text-[7.5px] py-2.5 text-center"
                    >
                      + ADD TO SLIP
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
