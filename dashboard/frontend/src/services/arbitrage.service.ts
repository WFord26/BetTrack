/**
 * Arbitrage & Middle Detection — Frontend API Service
 */

import api from './api';
import {
  ArbitrageOpportunity,
  ArbitrageStats,
  StakePlan,
  ArbType,
  ArbMarketType,
  ArbitrageLiveResponse,
  ArbitrageHistoryResponse,
  ArbitrageDetailResponse,
  ArbitrageStatsResponse,
  ArbitrageCalculatorResponse,
} from '../types/arbitrage.types';

export interface LiveQuery {
  limit?: number;
  minProfit?: number;
  arbType?: ArbType;
  marketType?: ArbMarketType;
  maxSnapshotAge?: number;
}

class ArbitrageService {
  /** Active opportunities, best profit first. */
  async getLive(query: LiveQuery = {}): Promise<{
    opportunities: ArbitrageOpportunity[];
    count: number;
    retrievedAt: string | null;
  }> {
    const response = await api.get<ArbitrageLiveResponse>('/analytics/arbitrage/live', {
      params: query,
    });
    return {
      opportunities: response.data.data?.opportunities || [],
      count: response.data.data?.count || 0,
      retrievedAt: response.data.data?.retrievedAt || null,
    };
  }

  /** Previously detected opportunities. */
  async getHistory(
    params: { limit?: number; daysBack?: number; status?: string; mine?: boolean } = {}
  ): Promise<{ opportunities: ArbitrageOpportunity[]; count: number; period: string }> {
    const response = await api.get<ArbitrageHistoryResponse>('/analytics/arbitrage/history', {
      params,
    });
    return {
      opportunities: response.data.data?.opportunities || [],
      count: response.data.data?.count || 0,
      period: response.data.data?.period || '',
    };
  }

  /** Detection and realisation statistics. */
  async getStats(daysBack: number = 30, mine: boolean = false): Promise<ArbitrageStats | null> {
    const response = await api.get<ArbitrageStatsResponse>('/analytics/arbitrage/stats', {
      params: { daysBack, mine },
    });
    return response.data.data || null;
  }

  /** Full detail for a single opportunity. */
  async getById(id: string): Promise<ArbitrageOpportunity | null> {
    const response = await api.get<ArbitrageDetailResponse>(`/analytics/arbitrage/${id}`);
    return response.data.data || null;
  }

  /** Mark an opportunity as taken. */
  async markTaken(id: string, actualProfit?: number): Promise<ArbitrageOpportunity | null> {
    const response = await api.post<ArbitrageDetailResponse>(
      `/analytics/arbitrage/${id}/take`,
      actualProfit === undefined ? {} : { actualProfit }
    );
    return response.data.data || null;
  }

  /** Stateless stake calculator (2 to 4 legs). */
  async calculate(odds: number[], totalStake: number): Promise<StakePlan | null> {
    const response = await api.post<ArbitrageCalculatorResponse>(
      '/analytics/arbitrage/calculator',
      { odds, totalStake }
    );
    return response.data.data || null;
  }
}

export const arbitrageService = new ArbitrageService();
