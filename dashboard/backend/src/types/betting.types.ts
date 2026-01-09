/**
 * Betting-related TypeScript types
 */

export type BetOutcome = 'won' | 'lost' | 'push';

export type BetSelection = 'home' | 'away' | 'over' | 'under';

export type Sport = 'nfl' | 'nba' | 'mlb' | 'nhl';

export interface BetLegOdds {
  odds: number;
}

export interface TeaserConfig {
  sport: Sport;
  points: number;
  legCount: number;
}

export interface SettlementContext {
  selection: BetSelection;
  line?: number;
  homeScore: number;
  awayScore: number;
}
