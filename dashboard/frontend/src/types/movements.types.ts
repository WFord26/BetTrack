/**
 * Line Movement Detection and Analytics Types
 */

export type MovementType = 'steam' | 'reverse' | 'gradual' | 'injury' | 'normal';
export type MarketType = 'h2h' | 'spreads' | 'totals';

export interface LineMovement {
  id: string;
  gameId: string;
  marketType: MarketType;
  detectedAt: string; // ISO datetime
  movementType: MovementType;
  linesBefore: Record<string, any>;
  linesAfter: Record<string, any>;
  bookmakerCount: number;
  averageMovement: number; // Decimal as string from API
  timeToMove: number; // seconds
  maxMovement?: number;
  suspectedCause?: string | null;
  game?: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    commenceTime: string;
    status: string;
    sportKey?: string;
    sportName?: string;
  };
}

export interface MovementStats {
  byType: {
    steam: number;
    reverse: number;
    gradual: number;
    injury: number;
    normal: number;
  };
  byMarket: {
    h2h: number;
    spreads: number;
    totals: number;
  };
}

export interface MovementResponse {
  status: 'success' | 'error';
  data: {
    movements: LineMovement[];
    total: number;
    hoursBack?: number;
    movementType?: string;
    statistics?: MovementStats;
    steamMovesCount?: number;
    totalMovements?: number;
    period?: string;
    byDate?: Record<string, LineMovement[]>;
    game?: {
      id: string;
      matchup: string;
      sport: string;
      commenceTime: string;
    };
    impactStats?: {
      totalMovements: number;
      steamMoves: number;
      avgMovementSize: string;
    };
    recentMovements?: LineMovement[];
    bookmaker?: string;
  } | null;
  error?: string;
}

export interface MovementFilters {
  type: MovementType | 'all';
  hoursBack: number;
  marketType?: MarketType;
  limit?: number;
}

export interface SteamMoveAlert {
  movement: LineMovement;
  severity: 'high' | 'medium' | 'low';
  icon: string;
}
