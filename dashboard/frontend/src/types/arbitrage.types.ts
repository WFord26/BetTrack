/**
 * Arbitrage & Middle Detection — shared frontend types
 */

export type ArbType = 'two-way' | 'three-way' | 'middle';
export type ArbMarketType = 'h2h' | 'spreads' | 'totals';
export type ArbRiskLevel = 'low' | 'medium' | 'high';
export type ArbSide = 'home' | 'away' | 'over' | 'under' | 'draw';

export interface ArbLeg {
  side: ArbSide;
  label: string;
  bookmaker: string;
  odds: number;
  line: number | null;
  stake: number;
  toWin: number;
}

export interface ArbGame {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  commenceTime: string;
  status?: string;
  sport?: { key: string; name: string };
}

export interface ArbitrageOpportunity {
  id: string;
  gameId: string;
  detectedAt: string;
  expiresAt: string;
  arbType: ArbType;
  marketType: ArbMarketType;
  profitPercentage: string | number;
  stake: string | number;
  expectedProfit: string | number;
  legs: ArbLeg[];
  middleProbability: string | number | null;
  middleGapLow: string | number | null;
  middleGapHigh: string | number | null;
  riskLevel: ArbRiskLevel;
  riskFactors: string[];
  limitRisk: boolean;
  oddsDrift: string | number | null;
  oddsSnapshotAge: number;
  status: 'active' | 'expired' | 'taken';
  takenAt: string | null;
  userId: string | null;
  actualProfit: string | number | null;
  game?: ArbGame;
}

export interface StakePlan {
  odds: number[];
  totalStake: number;
  stakes: number[];
  payouts: number[];
  totalImpliedProbability: number;
  guaranteedProfit: number;
  profitPercentage: number;
  isArbitrage: boolean;
}

export interface ArbitrageStats {
  periodDays: number;
  totalDetected: number;
  activeNow: number;
  detectionsPerDay: number;
  averageProfitPercentage: number;
  bestProfitPercentage: number;
  averageSnapshotAgeSeconds: number;
  taken: {
    count: number;
    expectedProfit: number;
    actualProfit: number;
  };
  byType: Record<string, { count: number; averageProfitPercentage: number }>;
  byStatus: Record<string, number>;
}

export interface ArbitrageAlertSettings {
  enabled: boolean;
  minProfitPercentage: number;
  maxStake: number;
  maxSnapshotAgeSeconds: number;
  includeMiddles: boolean;
  preferredBookmakers: string[];
  sports: string[];
}

export const DEFAULT_ALERT_SETTINGS: ArbitrageAlertSettings = {
  enabled: true,
  minProfitPercentage: 1,
  maxStake: 1000,
  maxSnapshotAgeSeconds: 600,
  includeMiddles: true,
  preferredBookmakers: [],
  sports: [],
};

export interface ArbitrageLiveResponse {
  success: boolean;
  data?: {
    opportunities: ArbitrageOpportunity[];
    count: number;
    retrievedAt: string;
  };
}

export interface ArbitrageHistoryResponse {
  success: boolean;
  data?: {
    opportunities: ArbitrageOpportunity[];
    count: number;
    period: string;
  };
}

export interface ArbitrageDetailResponse {
  success: boolean;
  data?: ArbitrageOpportunity;
}

export interface ArbitrageStatsResponse {
  success: boolean;
  data?: ArbitrageStats;
}

export interface ArbitrageCalculatorResponse {
  success: boolean;
  data?: StakePlan;
}
