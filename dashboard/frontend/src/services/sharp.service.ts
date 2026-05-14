/**
 * Sharp vs Public Money Indicators — Frontend API Service
 */

import api from './api';
import {
  SharpIndicator,
  ContrarianOpportunity,
  SharpStats,
  SharpLiveResponse,
  SharpGameResponse,
  SharpContrarianResponse,
  SharpStatsResponse,
} from '../types/sharp.types';

class SharpService {
  /**
   * Get current sharp-money indicators for scheduled games.
   */
  async getLiveIndicators(limit: number = 20): Promise<{ indicators: SharpIndicator[]; count: number }> {
    const response = await api.get<SharpLiveResponse>('/analytics/sharp/live', {
      params: { limit },
    });
    return {
      indicators: response.data.data?.indicators || [],
      count: response.data.data?.count || 0,
    };
  }

  /**
   * Get sharp indicators for a specific game.
   */
  async getGameIndicators(gameId: string): Promise<{
    game: any;
    indicators: SharpIndicator[];
  }> {
    const response = await api.get<SharpGameResponse>(`/analytics/sharp/game/${gameId}`);
    return {
      game: response.data.data?.game || null,
      indicators: response.data.data?.indicators || [],
    };
  }

  /**
   * Get contrarian opportunities (sharp vs public divergence).
   */
  async getContrarianOpportunities(
    minConfidence: number = 6,
    limit: number = 20
  ): Promise<{ opportunities: ContrarianOpportunity[]; count: number }> {
    const response = await api.get<SharpContrarianResponse>('/analytics/sharp/contrarian', {
      params: { minConfidence, limit },
    });
    return {
      opportunities: response.data.data?.opportunities || [],
      count: response.data.data?.count || 0,
    };
  }

  /**
   * Get summary statistics for sharp indicators.
   */
  async getStats(hoursBack: number = 24): Promise<SharpStats> {
    const response = await api.get<SharpStatsResponse>('/analytics/sharp/stats', {
      params: { hoursBack },
    });
    return (
      response.data.data || {
        byMarket: {},
        bySharpSide: {},
        byLineMovement: {},
        avgConfidence: 0,
        totalIndicators: 0,
        period: `Last ${hoursBack} hours`,
      }
    );
  }
}

export const sharpService = new SharpService();
