/**
 * HighDisagreementGames - Dashboard widget
 *
 * Displays the top games where bookmakers strongly disagree on odds,
 * indicating market uncertainty and potential value opportunities.
 * Refreshes every 60 seconds.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import {
  HighDisagreementGame,
  getDisagreementCategory,
  getDisagreementBadgeColor,
} from '../../types/disagreement.types';
import { useDarkMode } from '../../contexts/DarkModeContext';

const REFRESH_INTERVAL_MS = 60_000;
const DEFAULT_THRESHOLD = 60;
const MAX_DISPLAYED = 5;

interface Props {
  threshold?: number;
  onGameClick?: (game: HighDisagreementGame) => void;
}

export default function HighDisagreementGames({ threshold = DEFAULT_THRESHOLD, onGameClick }: Props) {
  const { isDarkMode } = useDarkMode();
  const [games, setGames] = useState<HighDisagreementGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      const res = await api.get('/analytics/disagreement/live', {
        params: { threshold, limit: MAX_DISPLAYED },
      });
      setGames(res.data.data?.games ?? []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to load disagreement data');
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchGames]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const containerClass = isDarkMode
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-900';

  if (loading) {
    return (
      <div className={`rounded-xl border p-4 ${containerClass}`}>
        <h3 className="font-semibold text-sm mb-3">📊 High Disagreement Games</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`h-12 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border p-4 ${containerClass}`}>
        <h3 className="font-semibold text-sm mb-2">📊 High Disagreement Games</h3>
        <p className="text-xs text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${containerClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">📊 High Disagreement Games</h3>
        <Link
          to="/analytics/disagreement"
          className="text-xs text-blue-500 hover:underline"
        >
          View all →
        </Link>
      </div>

      {games.length === 0 ? (
        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No high-disagreement games right now.
        </p>
      ) : (
        <ul className="space-y-2">
          {games.map((game) => {
            const category = getDisagreementCategory(game.maxDisagreementScore);
            const badgeColor = getDisagreementBadgeColor(game.maxDisagreementScore);

            return (
              <li key={game.gameId}>
                <button
                  onClick={() => onGameClick?.(game)}
                  className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                    isDarkMode
                      ? 'hover:bg-gray-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs font-medium truncate">
                        {game.awayTeamName} @ {game.homeTeamName}
                      </p>
                      <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formatTime(game.commenceTime)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                        {game.maxDisagreementScore}
                      </span>
                      <span className={`text-xs capitalize ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {category}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {lastUpdated && (
        <p className={`text-xs mt-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
