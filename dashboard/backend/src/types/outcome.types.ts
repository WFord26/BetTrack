/**
 * Types for outcome resolution and ESPN API
 */

export interface GameResult {
  homeScore: number;
  awayScore: number;
  status: string; // 'STATUS_FINAL', etc.
  completed: boolean;
}

export interface ResolveResult {
  success: boolean;
  gamesChecked: number;
  gamesUpdated: number;
  legsSettled: number;
  betsSettled: number;
  errors: string[];
}

// ESPN API Types
export interface EspnCompetitor {
  id: string;
  team: {
    id: string;
    displayName: string;
    abbreviation: string;
  };
  score: string;
  homeAway: 'home' | 'away';
}

export interface EspnEvent {
  id: string;
  name: string;
  shortName: string;
  competitions: Array<{
    id: string;
    status: {
      type: {
        id: string;
        name: string;
        state: string;
        completed: boolean;
      };
    };
    competitors: EspnCompetitor[];
  }>;
}

export interface EspnScoreboardResponse {
  leagues: Array<{
    id: string;
    name: string;
  }>;
  events: EspnEvent[];
}

// Sport to ESPN mapping
export interface SportMapping {
  sport: string;
  league: string;
}

export const ESPN_SPORT_MAPPING: Record<string, SportMapping> = {
  'americanfootball_nfl': { sport: 'football', league: 'nfl' },
  'americanfootball_ncaaf': { sport: 'football', league: 'college-football' },
  'basketball_nba': { sport: 'basketball', league: 'nba' },
  'basketball_ncaab': { sport: 'basketball', league: 'mens-college-basketball' },
  'icehockey_nhl': { sport: 'hockey', league: 'nhl' },
  'baseball_mlb': { sport: 'baseball', league: 'mlb' }
};
