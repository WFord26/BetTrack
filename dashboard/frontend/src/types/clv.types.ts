/**
 * Type definitions for CLV (Closing Line Value) analytics
 */

export interface CLVSummary {
  totalBets: number;
  averageCLV: number;
  positiveCLVCount: number;
  negativeCLVCount: number;
  neutralCLVCount: number;
  clvWinRate: number;
  expectedROI: number;
  actualROI: number;
}

export interface CLVBySport {
  sport: string;
  sportName: string;
  totalBets: number;
  averageCLV: number;
  positiveCLVCount: number;
  negativeCLVCount: number;
  clvWinRate: number;
}

export interface CLVByBookmaker {
  bookmaker: string;
  totalBets: number;
  averageCLV: number;
  positiveCLVCount: number;
  negativeCLVCount: number;
  clvWinRate: number;
}

export interface CLVTrend {
  date: string;
  averageCLV: number;
  betCount: number;
  winRate: number;
}

export interface CLVBetDetail {
  betId: string;
  gameId: string;
  sportKey: string;
  sportName: string;
  matchup: string;
  selectionType: string;
  odds: number;
  closingOdds: number;
  clv: number;
  clvCategory: 'positive' | 'negative' | 'neutral';
  outcome?: 'won' | 'lost' | 'push';
  createdAt: string;
}

export interface CLVReport {
  summary: CLVSummary;
  bySport: CLVBySport[];
  byBookmaker: CLVByBookmaker[];
  trends: CLVTrend[];
  topBets: CLVBetDetail[];
  worstBets: CLVBetDetail[];
}

export interface CLVFilters {
  sportKey?: string;
  betType?: string;
  startDate?: string;
  endDate?: string;
  period?: 'week' | 'month' | 'season' | 'all-time';
}
