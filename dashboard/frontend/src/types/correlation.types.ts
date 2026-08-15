/**
 * Bet Leg Correlation & Parlay Analysis — shared frontend types
 */

export type CorrelationType = 'same-game' | 'derivative' | 'inverse' | 'temporal';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Recommendation = 'approve' | 'warning' | 'reject';

export interface Correlation {
  type: CorrelationType;
  score: number;
  confidence: number;
  reasoning: string;
  factors: string[];
}

export interface CorrelationFlag {
  betLeg1Id: string;
  betLeg2Id: string;
  type: CorrelationType;
  score: number;
}

export interface ParlayAnalysis {
  betLegIds: string[];
  betId: string | null;
  nominalOdds: number;
  trueOdds: number;
  oddsDiscrepancy: number;
  riskLevel: RiskLevel;
  correlationFlags: CorrelationFlag[];
  recommendation: Recommendation;
  reasoning: string;
  suggestedFix: string | null;
}

export interface DraftLegInput {
  gameId: string;
  selectionType: 'moneyline' | 'spread' | 'total';
  selection: 'home' | 'away' | 'over' | 'under';
  teamName?: string;
  line?: number;
  odds: number;
  sgpGroupId?: string | null;
}

export interface HedgeOption {
  gameId: string;
  bookmaker: string;
  selection: 'home' | 'away' | 'over' | 'under';
  odds: number;
  hedgeStake: number;
  guaranteedProfit: number;
  guaranteedProfitPct: number;
}

export interface CorrelationEducationContent {
  correlationTypes: Array<{
    type: CorrelationType;
    label: string;
    summary: string;
    example: string;
  }>;
  glossary: Array<{ term: string; definition: string }>;
  warningLevels: Array<{ level: string; threshold: string; icon: string }>;
}

// ─── API response envelopes ─────────────────────────────────────────────────

export interface AnalyzePairResponse {
  success: boolean;
  data: { correlated: boolean; correlation: Correlation | null };
}

export interface AnalyzeParlayResponse {
  success: boolean;
  data: ParlayAnalysis;
}

export interface CorrelationHistoryResponse {
  success: boolean;
  data: { analyses: ParlayAnalysis[]; count: number };
}

export interface HedgeResponse {
  success: boolean;
  data: { opportunities: HedgeOption[]; count: number };
}

export interface CorrelationEducationResponse {
  success: boolean;
  data: CorrelationEducationContent;
}
