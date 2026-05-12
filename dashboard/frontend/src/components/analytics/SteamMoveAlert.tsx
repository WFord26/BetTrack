/**
 * SteamMoveAlert Component
 * Displays live steam moves in a dashboard banner/widget
 * Shows most recent steam moves with game context and movement details
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchSteamMoves, selectLiveMovements, selectMovementLoading } from '../../store/movementSlice';
import { LineMovement } from '../../types/movements.types';
import { useDarkMode } from '../../contexts/DarkModeContext';
import { useNavigate } from 'react-router-dom';

interface SteamMoveAlertProps {
  limit?: number;
  compact?: boolean;
  refreshInterval?: number;
}

export default function SteamMoveAlert({
  limit = 10,
  compact = false,
  refreshInterval = 60000 // 1 minute default
}: SteamMoveAlertProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isDarkMode } = useDarkMode();
  const movements = useSelector(selectLiveMovements);
  const loading = useSelector(selectMovementLoading);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch steam moves on mount
  useEffect(() => {
    dispatch(fetchSteamMoves(limit));
  }, [dispatch, limit]);

  // Auto-refresh logic
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      dispatch(fetchSteamMoves(limit));
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [dispatch, limit, refreshInterval, autoRefresh]);

  const getSeverityColor = (bookmakerCount: number, avgMovement: number): string => {
    if (bookmakerCount >= 5 && avgMovement >= 2.5) {
      return isDarkMode ? 'bg-red-900/30 border-red-600' : 'bg-red-100 border-red-400';
    }
    if (bookmakerCount >= 4 && avgMovement >= 2.0) {
      return isDarkMode ? 'bg-orange-900/30 border-orange-600' : 'bg-orange-100 border-orange-400';
    }
    return isDarkMode ? 'bg-amber-900/30 border-amber-600' : 'bg-amber-100 border-amber-400';
  };

  const getSeverityBadge = (bookmakerCount: number, avgMovement: number): string => {
    if (bookmakerCount >= 5 && avgMovement >= 2.5) return 'CRITICAL';
    if (bookmakerCount >= 4 && avgMovement >= 2.0) return 'HIGH';
    return 'MEDIUM';
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const marketLabel = (market: string): string => {
    return { h2h: 'Moneyline', spreads: 'Spreads', totals: 'Totals' }[market] || market;
  };

  if (compact && movements.length === 0) {
    return null;
  }

  return (
    <div
      className={`${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } rounded-lg border shadow-sm overflow-hidden`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b ${
          isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Live Steam Moves
          </h3>
          {movements.length > 0 && (
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                isDarkMode ? 'bg-red-900/50 text-red-200' : 'bg-red-100 text-red-800'
              }`}
            >
              {movements.length} detected
            </span>
          )}
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-2 py-1 rounded text-xs font-medium transition ${
            autoRefresh
              ? isDarkMode
                ? 'bg-green-900/50 text-green-200'
                : 'bg-green-100 text-green-800'
              : isDarkMode
              ? 'bg-gray-700 text-gray-300'
              : 'bg-gray-200 text-gray-600'
          }`}
        >
          {autoRefresh ? '⏱ Live' : '⏸ Paused'}
        </button>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {loading && movements.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="inline-block animate-spin">⌛</div>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Loading steam moves...
            </p>
          </div>
        ) : movements.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              No steam moves detected in the last 24 hours
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {movements.map((movement: LineMovement) => (
              <div
                key={movement.id}
                className={`p-4 border-l-4 cursor-pointer transition hover:${
                  isDarkMode ? 'bg-gray-750' : 'bg-gray-50'
                } ${getSeverityColor(
                  movement.bookmakerCount,
                  typeof movement.averageMovement === 'string' ? parseFloat(movement.averageMovement) : movement.averageMovement
                )}`}
                onClick={() => {
                  if (movement.game?.id) {
                    navigate(`/game/${movement.game.id}`);
                  }
                }}
              >
                {/* Matchup and severity */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {movement.game?.homeTeamName || 'Unknown'} vs{' '}
                      {movement.game?.awayTeamName || 'Unknown'}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {movement.game?.commenceTime
                        ? new Date(movement.game.commenceTime).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                        getSeverityBadge(
                          movement.bookmakerCount,
                          typeof movement.averageMovement === 'string' ? parseFloat(movement.averageMovement) : movement.averageMovement
                        ) === 'CRITICAL'
                          ? isDarkMode
                            ? 'bg-red-600 text-white'
                            : 'bg-red-600 text-white'
                          : getSeverityBadge(
                              movement.bookmakerCount,
                              typeof movement.averageMovement === 'string' ? parseFloat(movement.averageMovement) : movement.averageMovement
                            ) === 'HIGH'
                          ? isDarkMode
                            ? 'bg-orange-600 text-white'
                            : 'bg-orange-600 text-white'
                          : isDarkMode
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {getSeverityBadge(
                        movement.bookmakerCount,
                        typeof movement.averageMovement === 'string' ? parseFloat(movement.averageMovement) : movement.averageMovement
                      )}
                    </span>
                  </div>
                </div>

                {/* Movement details */}
                <div className="grid grid-cols-3 gap-3 text-sm mb-2">
                  <div>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Market
                    </p>
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {marketLabel(movement.marketType)}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Avg Movement
                    </p>
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {(typeof movement.averageMovement === 'string' ? parseFloat(movement.averageMovement) : movement.averageMovement).toFixed(2)} pts
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Books
                    </p>
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {movement.bookmakerCount} moved
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    {movement.timeToMove}s to move
                  </span>
                  <span className={isDarkMode ? 'text-gray-500' : 'text-gray-500'}>
                    {formatTime(movement.detectedAt)}
                  </span>
                </div>

                {movement.suspectedCause && (
                  <p className={`text-xs mt-2 italic ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Cause: {movement.suspectedCause}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer action */}
      {movements.length > 0 && !compact && (
        <div
          className={`px-4 py-3 border-t ${isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}
        >
          <button
            onClick={() => navigate('/analytics/movements')}
            className={`w-full px-3 py-2 rounded font-medium text-sm transition ${
              isDarkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            View All Movements →
          </button>
        </div>
      )}
    </div>
  );
}
