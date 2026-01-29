import React, { useState, useEffect } from 'react';
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
            <div className="text-6xl mb-4 animate-bounce">🎮</div>
            <div className="text-white text-xl font-bold mb-2">Loading Games...</div>
            <div className="text-gray-400">Fetching the latest odds</div>
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <span className="text-5xl">🎮</span>
          BetTrack Sports Hub
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Track odds, place bets, and analyze stats across all major sports
        </p>
      </div>

      {/* Date Selector */}
      <div className="mb-6">
        <label className="block text-white font-bold mb-2">Select Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-red-600 focus:outline-none"
        />
      </div>

      {/* Filters */}
      <GameFilters
        selectedSports={selectedSports}
        onSportToggle={handleSportToggle}
        selectedStatus={selectedStatus}
        onStatusChange={handleStatusChange}
        selectedBookmaker={selectedBookmaker}
        onBookmakerChange={handleBookmakerChange}
        availableSports={availableSports}
        availableBookmakers={availableBookmakers}
      />

      {/* Games Count */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          {filteredGames.length} {filteredGames.length === 1 ? 'Game' : 'Games'} Found
        </h2>
        {filteredGames.length !== games.length && (
          <span className="text-gray-400 text-sm">
            (filtered from {games.length} total)
          </span>
        )}
      </div>

      {/* Games Grid */}
      {filteredGames.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-white text-xl font-bold mb-2">No Games Found</h3>
          <p className="text-gray-400 mb-4">
            Try adjusting your filters or selecting a different date
          </p>
          <button
            onClick={() => {
              setSelectedSports([]);
              setSelectedStatus('all');
            }}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGames.map((game) => {
            // Filter bookmakers if a specific one is selected
            const filteredGame = selectedBookmaker !== 'all' ? {
              ...game,
              bookmakers: game.bookmakers?.filter(b => b.key === selectedBookmaker)
            } : game;
            
            return <EnhancedGameCard key={game.id} game={filteredGame} />;
          })}
        </div>
      )}

      {/* Bet Slip */}
      <BetSlip />
    </div>
  );
}
