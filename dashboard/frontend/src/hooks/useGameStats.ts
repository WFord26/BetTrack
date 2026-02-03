import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface Team {
  id: number;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
}

interface GameTeamStats {
  id: string;
  teamId: number;
  isHome: boolean;
  quarterScores: number[] | null;
  stats: Record<string, any>;
  team: Team;
}

interface Player {
  id: number;
  firstName: string;
  lastName: string;
  position: string | null;
  number: number | null;
}

interface PlayerGameStats {
  id: string;
  playerId: number;
  stats: Record<string, any>;
  started: boolean;
  minutesPlayed: string | null;
  player: Player;
  team: {
    id: number;
    name: string;
    abbreviation: string | null;
    logoUrl: string | null;
  };
}

interface GameStats {
  teamStats: GameTeamStats[];
  playerStats: PlayerGameStats[];
  seasonAverages?: GameTeamStats[];
}

interface UseGameStatsReturn {
  data: GameStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGameStats(gameId: string, pollInterval?: number): UseGameStatsReturn {
  const [data, setData] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get(`/stats/game/${gameId}`);
      if (response.data.success) {
        setData(response.data.data);
        setError(null);
      } else {
        setError(response.data.error || 'Failed to fetch game stats');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch game stats');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchStats();

    if (pollInterval && pollInterval > 0) {
      const interval = setInterval(fetchStats, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStats, pollInterval]);

  return { data, loading, error, refetch: fetchStats };
}
