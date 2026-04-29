import React, { useState, useEffect } from 'react';
import GameFilters from '../components/filters/GameFilters';
import EnhancedGameCard from '../components/odds/EnhancedGameCard';
import BetSlip from '../components/bets/BetSlip';
import { useDarkMode } from '../contexts/DarkModeContext';
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
  const { isDarkMode } = useDarkMode();
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
  const fetchGames = async () => {
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
  };

  useEffect(() => {
    fetchGames();
  }, [selectedDate]);

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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="font-display font-bold text-xl text-gray-900 dark:text-white mb-1">Loading Games...</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">Fetching the latest odds</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
          <h3 className="text-red-400 font-bold text-xl mb-2">Error Loading Games</h3>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 relative" style={{ imageRendering: 'pixelated' }}>
      {/* 8-bit Pixel Grid Background */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            ${isDarkMode ? '#dc2626' : '#b91c1c'} 0px,
            transparent 2px,
            transparent 4px,
            ${isDarkMode ? '#dc2626' : '#b91c1c'} 4px
          ),
          repeating-linear-gradient(
            90deg,
            ${isDarkMode ? '#dc2626' : '#b91c1c'} 0px,
            transparent 2px,
            transparent 4px,
            ${isDarkMode ? '#dc2626' : '#b91c1c'} 4px
          )`,
          backgroundSize: '4px 4px',
          imageRendering: 'pixelated'
        }}
      />
      
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 rounded-lg border-2 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-lg"
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
      <aside className={`
        w-80 h-screen overflow-y-auto bg-white dark:bg-gray-900 border-r-4 border-red-600 dark:border-red-700
        fixed lg:relative z-40 lg:z-auto
        transition-transform duration-300 ease-in-out
        ${mobileFiltersOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{
        boxShadow: '4px 0 0 rgba(220, 38, 38, 0.3)',
        imageRendering: 'pixelated'
      }}>
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-display font-bold text-gray-900 dark:text-white text-shadow-pixel tracking-wide">
          {filteredGames.length} {filteredGames.length === 1 ? 'Game' : 'Games'} Found
        </h2>
        {filteredGames.length !== games.length && (
          <span className="text-gray-600 dark:text-gray-400 text-sm">
            (filtered from {games.length} total)
          </span>
        )}
      </div>

      {/* Games Grid */}
      {filteredGames.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center border-4 border-red-600 dark:border-red-700"
             style={{
               boxShadow: '8px 8px 0px rgba(0, 0, 0, 0.3)',
               imageRendering: 'pixelated'
             }}>
          <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white text-shadow-pixel mb-2">No Games Found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Try adjusting your filters or selecting a different date
          </p>
          <button
            onClick={() => {
              setSelectedSports([]);
              setSelectedStatus('all');
            }}
            className="btn-primary"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
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
