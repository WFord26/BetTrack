import React, { useState, useEffect } from 'react';
import api from '../../services/api';

interface TeamStatsViewProps {
  league: string;
  teamName: string;
  season?: number;
}

type LocationFilter = 'all' | 'home' | 'away';

interface TeamStats {
  team?: { id: number | null; name: string; abbreviation: string | null; logoUrl: string | null; league: string };
  seasonStats: any;
  gameHistory: any[];
  splits: {
    home: Record<string, any>;
    away: Record<string, any>;
    overall: Record<string, any>;
  };
}

export default function TeamStatsView({ league, teamName, season }: TeamStatsViewProps) {
  const [location, setLocation] = useState<LocationFilter>('all');
  const [data, setData] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeamStats() {
      setLoading(true);
      setError(null);
      
      try {
        const params: Record<string, string> = { location };
        if (season) params.season = season.toString();

        const response = await api.get(`/stats/teams/${encodeURIComponent(league)}/${encodeURIComponent(teamName)}`, { params });
        setData(response.data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    fetchTeamStats();
  }, [league, teamName, season, location]);

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-800 rounded-lg p-6">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
        <h3 className="text-red-400 font-bold mb-2">Failed to load team stats</h3>
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-gray-400">No statistics available for this team</p>
      </div>
    );
  }

  const hasStats = data.splits.overall.games > 0;
  const currentSplits = location === 'all'
    ? data.splits.overall
    : location === 'home'
    ? data.splits.home
    : data.splits.away;

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-2">{data.team?.name || teamName}</h2>
        <p className="text-gray-400 text-sm uppercase tracking-wide mb-1">{league}</p>
        <p className="text-gray-400">
          {season ? `${season} Season` : 'Current Season'} Statistics
        </p>
      </div>

      {/* No Stats Notice */}
      {!hasStats && (
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-white font-bold text-lg mb-2">No Stats Available</h3>
          <p className="text-gray-400 text-sm">Game statistics for this team haven't been recorded yet.</p>
        </div>
      )}

      {hasStats && (
        <>
          {/* Filter Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => setLocation('all')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                location === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All Games
            </button>
            <button
              onClick={() => setLocation('home')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                location === 'home' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Home Games
            </button>
            <button
              onClick={() => setLocation('away')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                location === 'away' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Away Games
            </button>
          </div>

          {/* Split Statistics Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-red-400 font-bold mb-4 text-center">Home</h3>
              <div className="space-y-2">
                {Object.entries(data.splits.home.averages || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-white font-medium">{typeof value === 'number' ? value.toFixed(1) : String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-blue-400 font-bold mb-4 text-center">Away</h3>
              <div className="space-y-2">
                {Object.entries(data.splits.away.averages || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-white font-medium">{typeof value === 'number' ? value.toFixed(1) : String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-yellow-500/50">
              <h3 className="text-yellow-400 font-bold mb-4 text-center">Overall</h3>
              <div className="space-y-2">
                {Object.entries(data.splits.overall.averages || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-white font-medium">{typeof value === 'number' ? value.toFixed(1) : String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Current Filter Stats Detailed View */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              {location === 'all' ? 'Overall' : location === 'home' ? 'Home' : 'Away'} Performance
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(currentSplits.averages || {}).map(([key, value]) => (
                <div key={key} className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm capitalize mb-1">{key.replace(/_/g, ' ')}</p>
                  <p className="text-white text-2xl font-bold">{typeof value === 'number' ? value.toFixed(1) : String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Games */}
          {data.gameHistory.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">Recent Games</h3>
              <div className="space-y-2">
                {data.gameHistory.slice(0, 10).map((game: any) => (
                  <div
                    key={game.id}
                    className="bg-gray-700/50 rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-white font-medium">
                        {game.game.awayTeamName} @ {game.game.homeTeamName}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {new Date(game.game.commenceTime).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">
                        {game.game.awayScore} - {game.game.homeScore}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {game.isHome ? 'Home' : 'Away'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
