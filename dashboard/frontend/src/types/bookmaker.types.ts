/**
 * Bookmaker Performance Analytics — Frontend Types
 */

export type BookmakerRankingCriteria =
  | 'value'
  | 'sharpness'
  | 'reliability'
  | 'coverage'
  | 'limits'
  | 'recommendation';

export type LimitProfile = 'high' | 'medium' | 'low';

export interface BookmakerAnalytics {
  bookmaker: string;
  sharpBookRating: number; // 1–10
  bestOddsFrequency: number; // percentage
  marginVsConsensus: number; // average absolute deviation from consensus line
  outlierFrequency: number; // percentage of markets where this book is an outlier
  firstMoverFrequency: number; // percentage of movement events where this book moved first
  lineMovementLag: number; // seconds behind the first mover on average
  marketEfficiency: number; // 0–100 score
  uptimePercentage: number | null; // 0–100; null when no user reports exist in the window
  oddsUpdateFrequency: number; // seconds between updates on average
  averageOddsAge: number; // seconds since last update
  limitProfile: LimitProfile;
  estimatedMaxBet: number;
  recommendationScore: number | null; // 0–100; null when any weighted input is unavailable
  sportsCovered: string[];
  marketsCovered: string[];
  totalGamesOffered: number;
  totalMarketsOffered: number;
  averageCLVOffered?: number | null;
  calculatedAt?: string; // ISO datetime
  updatedAt?: string; // ISO datetime
}

export type BookmakerReportType = 'OUTAGE' | 'LIMIT_REDUCTION';

export interface BookmakerReportSummary {
  bookmaker: string;
  windowDays: number;
  outageReporterDays: number;
  limitReductionReporters: number;
  uptimePercentage: number | null;
  accountLimitReports: number;
  /** When the analytics job last recomputed the derived metrics; null if never. */
  calculatedAt: string | null;
}

export interface BookmakerOutlierStats {
  bookmaker: string;
  totalRecords: number;
  outlierCount: number;
  outlierRate: number; // percentage
  avgDeviation: number; // std devs away from consensus
  days?: number;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface BookmakerRankingsResponse {
  success: boolean;
  data: {
    rankings: BookmakerAnalytics[];
    criteria: BookmakerRankingCriteria;
    count: number;
  } | null;
  error?: string;
}

export interface BookmakerDetailResponse {
  success: boolean;
  data: BookmakerAnalytics | null;
  error?: string;
}

export interface BookmakerReportSummaryResponse {
  success: boolean;
  data: BookmakerReportSummary | null;
  error?: string;
}

export interface BookmakerOutlierResponse {
  success: boolean;
  data: BookmakerOutlierStats | null;
  error?: string;
}
