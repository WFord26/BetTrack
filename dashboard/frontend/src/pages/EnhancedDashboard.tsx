import React, { useState, useEffect, useCallback } from 'react';
import GameFilters from '../components/filters/GameFilters';
import EnhancedGameCard from '../components/odds/EnhancedGameCard';
import BetSlip from '../components/bets/BetSlip';
import api from '../services/api';

interface Game {
  id: string;
  sportKey: string;
  sportName: string;
  awayTeamName: string;
  homeTeamName: string;
  commenceTime: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  venue?: string;
  bookmakers?: any[];
}

export default function EnhancedDashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedBookmaker, setSelectedBookmaker] = useState('all');
  const [oddsFormat, setOddsFormat] = useState<'american' | 'decimal' | 'fractional'>('american');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Fetch games
  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {};
      if (selectedDate) {
        params.date = selectedDate;
        params.timezoneOffset = new Date().getTimezoneOffset();
      }

      const response = await api.get('/games', { params });
      const fetchedGames = response.data.data?.games || response.data.games || [];
      setGames(fetchedGames);
    } catch (err: any) {
      console.error('Error fetching games:', err);
      setError(err.response?.data?.message || 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      fetchGames();
    }, 30000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [fetchGames]);

  // Filter games based on selected filters
  const filteredGames = games.filter(game => {
    // Status filter
    if (selectedStatus === 'live' && game.status !== 'in_progress') return false;
    if (selectedStatus === 'upcoming' && game.status !== 'scheduled') return false;
    if (selectedStatus === 'completed' && game.status !== 'final') return false;

    // Sport filter
    if (selectedSports.length > 0 && !selectedSports.includes(game.sportKey)) return false;

    return true;
  });

  // Real live-game count from the currently filtered set
  const liveCount = React.useMemo(
    () => filteredGames.filter(game => game.status === 'in_progress').length,
    [filteredGames]
  );

  // Get available sports with counts
  const availableSports = React.useMemo(() => {
    const sportCounts = games.reduce((acc, game) => {
      acc[game.sportKey] = (acc[game.sportKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(sportCounts).map(([key, count]) => {
      const game = games.find(g => g.sportKey === key);
      return {
        key,
        name: game?.sportName || key,
        count,
      };
    });
  }, [games]);

  const handleSportToggle = (sport: string) => {
    setSelectedSports(prev =>
      prev.includes(sport)
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
  };

  const handleBookmakerChange = (bookmaker: string) => {
    setSelectedBookmaker(bookmaker);
  };

  const handleOddsFormatChange = (format: 'american' | 'decimal' | 'fractional') => {
    setOddsFormat(format);
  };

  // Get unique bookmakers from games
  const availableBookmakers = React.useMemo(() => {
    const bookmakers = new Set<string>();
    games.forEach(game => {
      game.bookmakers?.forEach(bookmaker => {
        bookmakers.add(bookmaker.key);
      });
    });
    return Array.from(bookmakers).sort();
  }, [games]);

  if (loading) {
    return (
      <div className="ds-sand-bg dark:bg-dusk dark:bg-none min-h-full container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-gold dark:border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="font-display text-[13px] text-ink dark:text-cream mb-2">Loading Games...</div>
            <div className="font-body text-ink-muted dark:text-cream-faint text-sm">Fetching the latest odds</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-sand-bg dark:bg-dusk dark:bg-none min-h-full container mx-auto px-4 py-8">
        <div className="ds-card-ink dark:ds-panel p-6">
          <h3 className="font-display text-[11px] text-terra dark:text-coral mb-2">Error Loading Games</h3>
          <p className="font-body text-ink-secondary dark:text-cream-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full ds-sand-bg dark:bg-dusk dark:bg-none relative">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 ds-btn-press-light dark:ds-btn-press p-3"
        aria-label="Toggle filters"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {mobileFiltersOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile Overlay */}
      {mobileFiltersOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setMobileFiltersOpen(false)}
        />
      )}

      {/* Fixed Left Sidebar */}
      <aside
        className={`
          w-80 h-screen overflow-y-auto ds-sand-bg dark:bg-dusk dark:bg-none
          fixed lg:relative z-40 lg:z-auto
          transition-transform duration-300 ease-in-out
          ${mobileFiltersOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-4 pt-20 lg:pt-8">
          <GameFilters
            selectedSports={selectedSports}
            onSportToggle={handleSportToggle}
            selectedStatus={selectedStatus}
            onStatusChange={handleStatusChange}
            selectedBookmaker={selectedBookmaker}
            onBookmakerChange={handleBookmakerChange}
            oddsFormat={oddsFormat}
            onOddsFormatChange={handleOddsFormatChange}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            availableSports={availableSports}
            availableBookmakers={availableBookmakers}
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="container mx-auto px-4 py-8 lg:py-8 pt-20 lg:pt-8">
          {/* Games Count */}
          <div className="mb-5 flex items-center gap-3 flex-wrap">
            <h2 className="font-display text-[13px] text-ink dark:text-cream [text-shadow:3px_3px_0_#e0a512] dark:[text-shadow:3px_3px_0_#c14d21]">
              {filteredGames.length} {filteredGames.length === 1 ? 'GAME' : 'GAMES'}
            </h2>
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-sand-panel border-2 border-ink dark:bg-coral-chip dark:border-0 px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-coral animate-ds-blink" />
                <span className="font-display text-[7px] text-terra dark:text-coral tracking-[.08em]">
                  {liveCount} LIVE
                </span>
              </span>
            )}
            {filteredGames.length !== games.length && (
              <span className="font-body text-ink-muted dark:text-cream-faint text-sm">
                (filtered from {games.length} total)
              </span>
            )}
          </div>

          {/* Games Grid */}
          {filteredGames.length === 0 ? (
            <div className="ds-card-ink dark:ds-panel p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-ink-muted dark:text-cream-faint mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="font-display text-[13px] text-ink dark:text-cream mb-2">No Games Found</h3>
              <p className="font-body text-ink-secondary dark:text-cream-secondary mb-4">
                Try adjusting your filters or selecting a different date
              </p>
              <button
                onClick={() => {
                  setSelectedSports([]);
                  setSelectedStatus('all');
                }}
                className="ds-btn-press-light dark:ds-btn-press font-display text-[7.5px] px-5 py-2.5"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {filteredGames.map((game) => {
                // Filter bookmakers if a specific one is selected
                const filteredGame = selectedBookmaker !== 'all' ? {
                  ...game,
                  bookmakers: game.bookmakers?.filter(b => b.key === selectedBookmaker)
                } : game;

                return <EnhancedGameCard key={game.id} game={filteredGame} oddsFormat={oddsFormat} />;
              })}
            </div>
          )}

          {/* Bet Slip */}
          <BetSlip />
        </div>
      </main>
    </div>
  );
}
