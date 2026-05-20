import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import GameStatsPanel from '../components/stats/GameStatsPanel';
import { formatTime } from '../utils/format';

interface Game {
  id: string;
  sportKey: string;
  sportName: string;
  awayTeamId: string;
  homeTeamId: string;
  awayTeamName: string;
  homeTeamName: string;
  commenceTime: string;
  status: string;
  completed: boolean;
  venue?: string;
  homeScore?: number;
  awayScore?: number;
}

export default function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGame() {
      if (!gameId) return;
      
      try {
        const response = await api.get(`/games/${gameId}`);
        const gameData = response.data.data || response.data;

        const transformedGame: Game = {
          id: gameData.id,
          sportKey: gameData.sport?.key || '',
          sportName: gameData.sport?.name || '',
          awayTeamId: gameData.awayTeamId,
          homeTeamId: gameData.homeTeamId,
          awayTeamName: gameData.awayTeamName,
          homeTeamName: gameData.homeTeamName,
          commenceTime: gameData.commenceTime,
          status: gameData.status,
          completed: gameData.status === 'final',
          venue: gameData.venue,
          homeScore: gameData.homeScore,
          awayScore: gameData.awayScore
        };

        setGame(transformedGame);
      } catch (error) {
        console.error('Error fetching game:', error);
        setError('Failed to load game details');
      } finally {
        setLoading(false);
      }
    }
    
    fetchGame();
  }, [gameId]);

  if (!gameId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
          <h2 className="text-red-400 font-bold text-xl mb-2">Invalid Game</h2>
          <p className="text-red-300">Game ID not provided</p>
        </div>
      </div>
    );
  }

  const isLive = game?.status === 'in_progress';
  const isCompleted = game?.status === 'final';
  const isScheduled = game?.status === 'scheduled';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 19l-7-7 7-7" 
            />
          </svg>
          Back
        </button>
        
        {isLive && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white font-bold text-sm">LIVE</span>
          </div>
        )}
        
        {isCompleted && (
          <div className="px-4 py-2 bg-gray-700 rounded-full">
            <span className="text-gray-300 font-bold text-sm">FINAL</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin mb-4">
              <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full" />
            </div>
            <p className="text-gray-400">Loading game details...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 mb-6">
          <h2 className="text-red-400 font-bold text-xl mb-2">Error</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Go Back
          </button>
        </div>
      )}

      {/* Game Matchup Card */}
      {!loading && game && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-3 gap-8 items-center">
            {/* Away Team */}
            <Link 
              to={`/teams/${encodeURIComponent(game.sportKey)}/${encodeURIComponent(game.awayTeamName)}`}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <div className="text-4xl mb-2">🏀</div>
              <h2 className="text-2xl font-bold text-white mb-2">{game.awayTeamName}</h2>
              <p className="text-gray-400 text-sm">Away</p>
              {(isLive || isCompleted) && game.awayScore !== undefined && (
                <p className="text-5xl font-bold text-blue-400 mt-4">{game.awayScore}</p>
              )}
            </Link>

            {/* Game Info */}
            <div className="text-center">
              {isScheduled && (
                <>
                  <div className="text-gray-400 text-sm mb-2">Game Time</div>
                  <div className="text-white font-bold text-lg">{formatTime(game.commenceTime)}</div>
                  <div className="text-gray-500 text-sm mt-2">
                    {new Date(game.commenceTime).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </>
              )}
              {(isLive || isCompleted) && (
                <div className="text-6xl font-bold text-gray-600">VS</div>
              )}
              {game.venue && (
                <div className="text-gray-500 text-sm mt-4">📍 {game.venue}</div>
              )}
            </div>

            {/* Home Team */}
            <Link 
              to={`/teams/${encodeURIComponent(game.sportKey)}/${encodeURIComponent(game.homeTeamName)}`}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <div className="text-4xl mb-2">🏀</div>
              <h2 className="text-2xl font-bold text-white mb-2">{game.homeTeamName}</h2>
              <p className="text-gray-400 text-sm">Home</p>
              {(isLive || isCompleted) && game.homeScore !== undefined && (
                <p className="text-5xl font-bold text-red-400 mt-4">{game.homeScore}</p>
              )}
            </Link>
          </div>
        </div>
      )}

      {/* Game Stats Panel */}
      <GameStatsPanel gameId={gameId} isLive={isLive} />
    </div>
  );
}
