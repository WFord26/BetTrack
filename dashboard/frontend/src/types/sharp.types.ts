/**
 * Sharp vs Public Money Indicators — Frontend Types
 */

export type SharpSide = 'home' | 'away' | 'over' | 'under' | 'none';
export type LineMovementCategory = 'steam' | 'reverse' | 'gradual' | 'no_movement';
export type SharpMarketType = 'h2h' | 'spreads' | 'totals';

export interface SharpIndicator {
  id: string;
  gameId: string;
  marketType: SharpMarketType;
  calculatedAt: string; // ISO datetime
  lineMovement: LineMovementCategory;
  sharpSide: SharpSide;
  publicSide: SharpSide;
  sharpConfidence: number; // 1-10
  contraindicators: string[];
  publicBettingPct?: number | null;
  publicMoneyPct?: number | null;
  game?: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    commenceTime: string;
    sport: { key: string; name: string };
  };
}

export interface ContrarianOpportunity {
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  commenceTime: string;
  sportKey: string;
  indicators: SharpIndicator[];
  maxConfidence: number;
}

export interface SharpStats {
  byMarket: Record<string, number>;
  bySharpSide: Record<string, number>;
  byLineMovement: Record<string, number>;
  avgConfidence: number;
  totalIndicators: number;
  period: string;
}

export interface SharpLiveResponse {
  success: boolean;
  data: {
    indicators: SharpIndicator[];
    count: number;
  } | null;
  error?: string;
}

export interface SharpGameResponse {
  success: boolean;
  data: {
    game: {
      id: string;
      matchup: string;
      sport: string;
      sportKey: string;
      commenceTime: string;
      status: string;
    };
    indicators: SharpIndicator[];
  } | null;
  error?: string;
}

export interface SharpContrarianResponse {
  success: boolean;
  data: {
    opportunities: ContrarianOpportunity[];
    count: number;
    minConfidence: number;
  } | null;
  error?: string;
}

export interface SharpStatsResponse {
  success: boolean;
  data: SharpStats | null;
  error?: string;
}
