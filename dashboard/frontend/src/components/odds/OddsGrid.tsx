import React, { useState, useEffect } from 'react';
import GameCard from './GameCard';
import SportFilter from './SportFilter';
import api from '../../services/api';
import { formatDate } from '../../utils/format';

interface Game {
  id: string;
  sportKey: string;
  sportName: string;
  awayTeamName: string;
  homeTeamName: string;
  commenceTime: string;
  status: string;
  awayOdds?: any;
  homeOdds?: any;
}

interface Selection {
  gameId: string;
  selectionType: 'moneyline' | 'spread' | 'total';
  selection: 'home' | 'away' | 'over' | 'under';
  odds: number;
  line?: number;
  gameName: string;
  teamName?: string;
}

interface OddsGridProps {
  onAddToBetSlip: (selection: Selection) => void;
  selectedBets?: Set<string>;
  useDecimalOdds?: boolean;
  onToggleOddsFormat?: () => void;
}

export default function OddsGrid({ onAddToBetSlip, selectedBets = new Set(), useDecimalOdds = false, onToggleOddsFormat }: OddsGridProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookmaker, setSelectedBookmaker] = useState('draftkings');
  const [bookmakers] = useState(['draftkings', 'fanduel', 'betmgm', 'pointsbet', 'bovada', 'mybookie']);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    // Use local date instead of UTC
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
        // Send timezone offset in minutes (negative for UTC-)
        params.timezoneOffset = new Date().getTimezoneOffset();
      }
      if (selectedSport !== 'all') {
        params.sport = selectedSport;
      }
      if (selectedBookmaker) {
        params.bookmaker = selectedBookmaker;
      }

      console.log('[OddsGrid] Fetching games with params:', params);
      const response = await api.get('/games', { params });
      console.log('[OddsGrid] API Response structure:', {
        hasData: !!response.data,
        hasDataData: !!response.data?.data,
        hasDataGames: !!response.data?.games,
        hasDataDataGames: !!response.data?.data?.games,
        dataDataGamesLength: response.data?.data?.games?.length,
        dataGamesLength: response.data?.games?.length
      });
      
      // API returns {status: 'success', data: {games: [...], count: 27}}
      // Axios wraps this, so we need response.data.data.games
      const games = response.data.data?.games || response.data.games || [];
      console.log('[OddsGrid] Extracted games array length:', games.length);
      console.log('[OddsGrid] First game sample:', games[0]);
      setGames(games);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching games:', err);
      setError(err.response?.data?.message || 'Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  // Fetch games on mount and when filters change
  useEffect(() => {
    fetchGames();
  }, [selectedDate, selectedSport, selectedBookmaker]);

  // Filter games by search query and group by sport
  useEffect(() => {
    console.log('[OddsGrid] Filtering games. Total games:', games.length, 'Search query:', searchQuery);
    
    if (!searchQuery.trim()) {
      setFilteredGames(games);
      console.log('[OddsGrid] No search query, showing all games:', games.length);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = games.filter(
      (game) =>
        game.awayTeamName.toLowerCase().includes(query) ||
        game.homeTeamName.toLowerCase().includes(query) ||
        game.sportName.toLowerCase().includes(query)
    );
    console.log('[OddsGrid] Filtered games:', filtered.length);
    setFilteredGames(filtered);
  }, [games, searchQuery]);
  
  // Group games by sport for display
  const gamesBySport = filteredGames.reduce((groups, game) => {
    const sport = game.sportKey;
    if (!groups[sport]) {
      groups[sport] = {
        sportKey: game.sportKey,
        sportName: game.sportName,
        games: []
      };
    }
    groups[sport].games.push(game);
    return groups;
  }, {} as Record<string, { sportKey: string; sportName: string; games: Game[] }>);
  
  const sportGroups = Object.values(gamesBySport);

  // Handle refresh
  const handleRefresh = () => {
    fetchGames();
  };

  // Handle sport filter change
  const handleSportChange = (sport: string) => {
    setSelectedSport(sport);
  };

  // Handle date change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="w-full md:w-auto">
            <div className="h-10 w-64 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-4">
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-4"></div>
              <div className="h-20 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-red-600 text-xl mb-4">⚠️ {error}</div>
        <button
          onClick={handleRefresh}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Left side: Date, Sport, and Bookmaker filters */}
          <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto">
            {/* Date picker */}
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />

            {/* Sport filter */}
            <div className="hidden md:block">
              <SportFilter value={selectedSport} onChange={handleSportChange} />
            </div>

            {/* Bookmaker dropdown */}
            <select
              value={selectedBookmaker}
              onChange={(e) => setSelectedBookmaker(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {bookmakers.map((bookmaker) => (
                <option key={bookmaker} value={bookmaker}>
                  {bookmaker.charAt(0).toUpperCase() + bookmaker.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Right side: Search and Refresh */}
          <div className="flex gap-2 w-full lg:w-auto">
            {/* Odds format toggle */}
            {onToggleOddsFormat && (
              <button
                onClick={onToggleOddsFormat}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2 font-medium"
                title="Toggle odds format"
              >
                {useDecimalOdds ? 'Decimal' : 'American'}
              </button>
            )}
            <input
              type="text"
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 lg:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Mobile sport filter */}
        <div className="md:hidden">
          <SportFilter value={selectedSport} onChange={handleSportChange} />
        </div>
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <div>
          {filteredGames.length} {filteredGames.length === 1 ? 'game' : 'games'} found
          {selectedDate && ` for ${formatDate(selectedDate)}`}
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500"
          >
            Clear search
          </button>
        )}
      </div>

      {/* Games grid - 3 columns, grouped by sport */}
      {filteredGames.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-4">🏀</div>
          <div className="text-xl mb-2">No games found</div>
          <div className="text-sm">
            {searchQuery
              ? 'Try a different search term'
              : 'Try selecting a different date or sport'}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {sportGroups.map((group) => (
            <div key={group.sportKey} className="space-y-4">
              {/* Sport section header */}
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 border-b-2 border-gray-300 dark:border-gray-600 pb-2">
                {group.sportName} ({group.games.length})
              </h2>
              
              {/* 3-column grid for game cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onSelect={onAddToBetSlip}
                    selectedBets={selectedBets}
                    useDecimalOdds={useDecimalOdds}
                    bookmaker={selectedBookmaker}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
