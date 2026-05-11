/**
 * Line Movement Analytics Service
 * Provides API calls for line movement detection and analysis
 */

import api from './api';
import { LineMovement, MovementResponse, MovementFilters, MovementStats } from '../types/movements.types';

class LineMovementService {
  /**
   * Get recent steam moves and active movements in real-time
   */
  async getLiveMovements(
    limit: number = 20,
    hoursBack: number = 4,
    movementType: string = 'steam'
  ): Promise<{ movements: LineMovement[]; total: number }> {
    const response = await api.get<MovementResponse>('/analytics/movements/live', {
      params: { limit, hoursBack, movementType }
    });
    return {
      movements: response.data.data?.movements || [],
      total: response.data.data?.total || 0
    };
  }

  /**
   * Get movements for a specific game
   */
  async getGameMovements(
    gameId: string,
    limit: number = 50
  ): Promise<{ movements: LineMovement[]; game: any }> {
    const response = await api.get<MovementResponse>(`/analytics/movements/game/${gameId}`, {
      params: { limit }
    });
    return {
      movements: response.data.data?.movements || [],
      game: response.data.data?.game
    };
  }

  /**
   * Get historical movement data with statistics
   */
  async getMovementHistory(
    hoursBack: number = 24,
    movementType?: string
  ): Promise<{
    statistics: MovementStats;
    movements: LineMovement[];
    byDate: Record<string, LineMovement[]>;
  }> {
    const params: any = { hoursBack };
    if (movementType) {
      params.movementType = movementType;
    }

    const response = await api.get<MovementResponse>('/analytics/movements/history', {
      params
    });

    return {
      statistics: response.data.data?.statistics || {
        byType: { steam: 0, reverse: 0, gradual: 0, injury: 0, normal: 0 },
        byMarket: { h2h: 0, spreads: 0, totals: 0 }
      },
      movements: response.data.data?.movements || [],
      byDate: response.data.data?.byDate || {}
    };
  }

  /**
   * Get movements for a specific bookmaker
   */
  async getBookmakerMovements(
    bookmaker: string,
    hoursBack: number = 24,
    marketType?: string
  ): Promise<{
    impactStats: any;
    recentMovements: LineMovement[];
  }> {
    const params: any = { hoursBack };
    if (marketType) {
      params.marketType = marketType;
    }

    const response = await api.get<MovementResponse>(
      `/analytics/movements/bookmaker/${encodeURIComponent(bookmaker)}`,
      { params }
    );

    return {
      impactStats: response.data.data?.impactStats,
      recentMovements: response.data.data?.recentMovements || []
    };
  }

  /**
   * Get movement statistics
   */
  async getMovementStats(hoursBack: number = 24): Promise<{
    statistics: MovementStats;
    steamMovesCount: number;
    totalMovements: number;
  }> {
    const response = await api.get<MovementResponse>('/analytics/movements/stats', {
      params: { hoursBack }
    });

    return {
      statistics: response.data.data?.statistics || {
        byType: { steam: 0, reverse: 0, gradual: 0, injury: 0, normal: 0 },
        byMarket: { h2h: 0, spreads: 0, totals: 0 }
      },
      steamMovesCount: response.data.data?.steamMovesCount || 0,
      totalMovements: response.data.data?.totalMovements || 0
    };
  }

  /**
   * Get steam moves (most important for bettors)
   */
  async getSteamMoves(limit: number = 20): Promise<LineMovement[]> {
    const response = await api.get<MovementResponse>('/analytics/movements/live', {
      params: { limit, hoursBack: 24, movementType: 'steam' }
    });
    return response.data.data?.movements || [];
  }
}

export const lineMovementService = new LineMovementService();
