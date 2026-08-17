/**
 * Shared types for arbitrage detection.
 *
 * Kept in one place so the calculator, finder, alert, scanner and query
 * modules can agree on a shape without importing each other.
 */

export type ArbMarketType = 'h2h' | 'spreads' | 'totals';
export type ArbType = 'two-way' | 'three-way' | 'middle';
export type RiskLevel = 'low' | 'medium' | 'high';
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

/** Minimal shape of a `CurrentOdds` row used by the pure detection helpers. */
export interface OddsRow {
  bookmaker: string;
  marketType: string;
  homePrice: number | null;
  awayPrice: number | null;
  homeSpread: number | null;
  homeSpreadPrice: number | null;
  awaySpread: number | null;
  awaySpreadPrice: number | null;
  totalLine: number | null;
  overPrice: number | null;
  underPrice: number | null;
  lastUpdated: Date;
}

export interface DetectionContext {
  homeTeamName?: string;
  awayTeamName?: string;
  sportKey?: string;
  totalStake?: number;
  /** Allow both legs to sit on the same bookmaker. Off by default. */
  allowSameBookmaker?: boolean;
}

export interface DetectedOpportunity {
  arbType: ArbType;
  marketType: ArbMarketType;
  profitPercentage: number;
  stake: number;
  expectedProfit: number;
  legs: ArbLeg[];
  /** Seconds since the oldest leg in this opportunity was last synced. */
  oddsSnapshotAge: number;
  middleProbability?: number;
  middleGapLow?: number;
  middleGapHigh?: number;
}

export interface RiskInput {
  profitPercentage: number;
  oddsSnapshotAge: number;
  oddsDrift: number | null;
  minutesToStart: number;
  bookmakers: string[];
  limitProfiles?: Record<string, string | null | undefined>;
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  factors: string[];
  limitRisk: boolean;
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

export interface ScanResult {
  gamesScanned: number;
  opportunitiesFound: number;
  opportunitiesCreated: number;
  opportunitiesRefreshed: number;
  expired: number;
  durationMs: number;
  errors: string[];
}
