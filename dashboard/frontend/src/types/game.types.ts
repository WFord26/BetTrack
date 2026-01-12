/**
 * Type definitions for games and odds
 */

export interface Sport {
  id: string;
  key: string;
  name: string;
  active: boolean;
}

export interface Team {
  id: string;
  name: string;
  abbreviation?: string;
  logo?: string;
}

export interface GameOdds {
  spread?: {
    line: number;
    odds: number;
  };
  total?: {
    line: number;
    odds: number;
  };
  moneyline?: number;
}

export interface Game {
  id: string;
  sportKey: string;
  sportName: string;
  awayTeamName: string;
  homeTeamName: string;
  commenceTime: string;
  venue?: string;
  weather?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
  awayScore?: number;
  homeScore?: number;
  awayOdds?: GameOdds;
  homeOdds?: GameOdds;
  createdAt: string;
  updatedAt: string;
}

export interface BetSelection {
  gameId: string;
  selectionType: 'moneyline' | 'spread' | 'total';
  selection: 'home' | 'away' | 'over' | 'under';
  odds: number;
  line?: number;
  gameName: string;
  teamName?: string;
}

export interface BetLeg {
  id?: string;
  gameId: string;
  selectionType: 'moneyline' | 'spread' | 'total';
  selection: 'home' | 'away' | 'over' | 'under';
  odds: number;
  line?: number;
  teamName?: string;
  status?: 'pending' | 'won' | 'lost' | 'push';
  game?: Game;
  sgpGroupId?: string | null;
}

export interface FutureLeg {
  id?: string;
  futureId: string;
  futureTitle: string;
  outcome: string;
  odds: number;
  status?: 'pending' | 'won' | 'lost' | 'push';
  sportKey?: string;
  userAdjustedOdds?: number;
}

export interface Bet {
  id: string;
  name: string;
  betType: 'single' | 'parlay' | 'teaser';
  status: 'pending' | 'won' | 'lost' | 'push' | 'cancelled';
  stake: number;
  oddsAtPlacement: number;
  potentialPayout?: number;
  actualPayout?: number;
  placedAt: string;
  settledAt?: string;
  legs: BetLeg[];
  futureLegs?: FutureLeg[];
}

export interface BetStats {
  totalBets: number;
  wonBets: number;
  lostBets: number;
  pushBets: number;
  winRate: number;
  totalStaked: number;
  totalReturn: number;
  netProfit: number;
  roi: number;
}
