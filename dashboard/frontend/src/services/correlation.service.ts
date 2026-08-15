/**
 * Bet Leg Correlation & Parlay Analysis — Frontend API Service
 */

import api from './api';
import {
  AnalyzePairResponse,
  AnalyzeParlayResponse,
  CorrelationHistoryResponse,
  HedgeResponse,
  CorrelationEducationResponse,
  Correlation,
  ParlayAnalysis,
  DraftLegInput,
  HedgeOption,
  RiskLevel,
  CorrelationEducationContent,
} from '../types/correlation.types';

class CorrelationService {
  /** Correlation between two existing bet legs. */
  async analyzePair(betLeg1Id: string, betLeg2Id: string): Promise<Correlation | null> {
    const response = await api.post<AnalyzePairResponse>('/analytics/correlation/analyze', {
      betLeg1Id,
      betLeg2Id,
    });
    return response.data.data?.correlation ?? null;
  }

  /** Analyze a placed bet's legs and true odds. */
  async analyzeBet(betId: string): Promise<ParlayAnalysis | null> {
    const response = await api.post<AnalyzeParlayResponse>('/analytics/correlation/parlay', {
      betId,
    });
    return response.data.data ?? null;
  }

  /** Analyze a draft slip (legs not yet saved) for correlation and true odds. */
  async analyzeDraftSlip(legs: DraftLegInput[]): Promise<ParlayAnalysis | null> {
    const response = await api.post<AnalyzeParlayResponse>('/analytics/correlation/parlay', {
      legs,
    });
    return response.data.data ?? null;
  }

  /** Historical parlay analyses. */
  async getHistory(
    params: { limit?: number; riskLevel?: RiskLevel; mine?: boolean } = {}
  ): Promise<{ analyses: ParlayAnalysis[]; count: number }> {
    const response = await api.get<CorrelationHistoryResponse>('/analytics/correlation/history', {
      params,
    });
    return {
      analyses: response.data.data?.analyses ?? [],
      count: response.data.data?.count ?? 0,
    };
  }

  /** Pre-game hedging opportunities for a moneyline leg. */
  async findHedges(betLegId: string): Promise<HedgeOption[]> {
    const response = await api.post<HedgeResponse>('/analytics/correlation/hedge', { betLegId });
    return response.data.data?.opportunities ?? [];
  }

  /** Static educational content. */
  async getEducation(): Promise<CorrelationEducationContent | null> {
    const response = await api.get<CorrelationEducationResponse>('/analytics/correlation/education');
    return response.data.data ?? null;
  }
}

export const correlationService = new CorrelationService();
