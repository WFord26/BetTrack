/**
 * Types for The Odds API responses
 */

export interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsApiMarket {
  key: string; // 'h2h', 'spreads', 'totals'
  last_update: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface OddsApiResponse {
  data: OddsApiEvent[];
  headers: {
    'x-requests-remaining'?: string;
    'x-requests-used'?: string;
  };
}

export interface SyncResult {
  success: boolean;
  gamesProcessed: number;
  oddsProcessed: number;
  snapshotsCreated: number;
  errors: string[];
  requestsRemaining?: number;
}

export interface ParsedMarketOdds {
  homePrice?: number;
  awayPrice?: number;
  homeSpread?: number;
  homeSpreadPrice?: number;
  awaySpread?: number;
  awaySpreadPrice?: number;
  totalLine?: number;
  overPrice?: number;
  underPrice?: number;
}
