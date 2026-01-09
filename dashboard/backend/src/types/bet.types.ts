import { Decimal } from '@prisma/client/runtime/library';

/**
 * Bet-related TypeScript types
 */

export type BetType = 'single' | 'parlay' | 'teaser';
export type BetStatus = 'pending' | 'won' | 'lost' | 'push';
export type SelectionType = 'moneyline' | 'spread' | 'total';
export type Selection = 'home' | 'away' | 'over' | 'under';

// ============================================================================
// CREATE BET
// ============================================================================

export interface CreateBetLegInput {
  gameId: string;
  selectionType: SelectionType;
  selection: Selection;
  teamName?: string;
  line?: number;
  odds: number;
  userAdjustedLine?: number;
  userAdjustedOdds?: number;
}

export interface CreateBetInput {
  name: string;
  betType: BetType;
  stake: number;
  legs: CreateBetLegInput[];
  teaserPoints?: number;
  notes?: string;
}

// ============================================================================
// UPDATE BET
// ============================================================================

export interface UpdateBetInput {
  name?: string;
  stake?: number;
  notes?: string;
}

// ============================================================================
// BET FILTERS
// ============================================================================

export interface BetFilters {
  status?: BetStatus | BetStatus[];
  betType?: BetType;
  sportKey?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface StatsFilters {
  sportKey?: string;
  betType?: BetType;
  startDate?: Date;
  endDate?: Date;
}

// ============================================================================
// BET RESPONSE TYPES
// ============================================================================

export interface BetLegResponse {
  id: string;
  selectionType: SelectionType;
  selection: Selection;
  teamName: string | null;
  line: Decimal | null;
  odds: number;
  userAdjustedLine: Decimal | null;
  userAdjustedOdds: number | null;
  teaserAdjustedLine: Decimal | null;
  status: BetStatus;
  game: {
    id: string;
    externalId: string;
    homeTeamName: string;
    awayTeamName: string;
    commenceTime: Date;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    sport: {
      key: string;
      name: string;
    };
  };
}

export interface BetResponse {
  id: string;
  name: string;
  betType: BetType;
  stake: Decimal;
  potentialPayout: Decimal | null;
  actualPayout: Decimal | null;
  status: BetStatus;
  oddsAtPlacement: number | null;
  teaserPoints: Decimal | null;
  notes: string | null;
  placedAt: Date;
  settledAt: Date | null;
  legs: BetLegResponse[];
}

export interface PaginatedBets {
  bets: BetResponse[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// BET STATS
// ============================================================================

export interface BetStats {
  totalBets: number;
  wonBets: number;
  lostBets: number;
  pushBets: number;
  pendingBets: number;
  winRate: number; // Percentage
  totalStaked: number;
  totalPayout: number;
  netProfit: number;
  roi: number; // Percentage
  byBetType: {
    [key in BetType]?: {
      count: number;
      won: number;
      netProfit: number;
    };
  };
  bySport: {
    [sportKey: string]: {
      count: number;
      won: number;
      netProfit: number;
    };
  };
}

// ============================================================================
// VALIDATION SCHEMAS (for Zod)
// ============================================================================

export const VALID_BET_TYPES: BetType[] = ['single', 'parlay', 'teaser'];
export const VALID_BET_STATUSES: BetStatus[] = ['pending', 'won', 'lost', 'push'];
export const VALID_SELECTION_TYPES: SelectionType[] = ['moneyline', 'spread', 'total'];
export const VALID_SELECTIONS: Selection[] = ['home', 'away', 'over', 'under'];
