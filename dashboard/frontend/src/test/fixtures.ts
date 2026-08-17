/**
 * Shared test fixtures.
 *
 * Every fixture here mirrors a real API contract: the response envelopes match
 * what `dashboard/backend/src/routes/analytics-*.routes.ts` actually sends
 * (`{ success, data }` for arbitrage/sharp/bookmaker/clv/correlation,
 * `{ status, data }` for movements), and the numbers are internally consistent
 * so assertions can check computed output rather than echoing a literal back.
 *
 * Builders take overrides so a test can vary the one field it cares about
 * without restating a whole object — an object that differs from the default in
 * exactly one place makes the assertion's subject obvious.
 */

import type {
  ArbitrageOpportunity,
  ArbitrageStats,
  ArbLeg,
  StakePlan,
} from '../types/arbitrage.types';
import type { BookmakerAnalytics, BookmakerOutlierStats } from '../types/bookmaker.types';
import type { CLVSummary, CLVBySport, CLVByBookmaker, CLVTrend } from '../types/clv.types';
import type { LineMovement, MovementStats } from '../types/movements.types';
import type { ContrarianOpportunity, SharpIndicator, SharpStats } from '../types/sharp.types';
import type { Game } from '../types/game.types';

/** Fixed clock so relative-time and freshness assertions stay deterministic. */
export const FIXED_NOW = new Date('2026-01-15T18:00:00.000Z');

export function iso(offsetMinutes = 0): string {
  return new Date(FIXED_NOW.getTime() + offsetMinutes * 60_000).toISOString();
}

// ─── Games ────────────────────────────────────────────────────────────────────

export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-lal-bos',
    sportKey: 'basketball_nba',
    sportName: 'NBA Basketball',
    awayTeamName: 'Los Angeles Lakers',
    homeTeamName: 'Boston Celtics',
    commenceTime: iso(120),
    status: 'scheduled',
    createdAt: iso(-1440),
    updatedAt: iso(-30),
    ...overrides,
  };
}

// ─── Arbitrage ────────────────────────────────────────────────────────────────

/**
 * A genuine two-way arbitrage: +150 and -130 on opposite sides.
 * Implied probability = 100/250 + 130/230 = 0.4000 + 0.5652 = 0.9652 < 1,
 * so the guaranteed profit on a $1,000 total stake is $36.03 (3.60%).
 * The leg stakes and payouts below are those exact figures, rounded to cents.
 */
export const ARB_LEGS: ArbLeg[] = [
  {
    side: 'away',
    label: 'Los Angeles Lakers',
    bookmaker: 'draftkings',
    odds: 150,
    line: null,
    stake: 414.42,
    toWin: 621.63,
  },
  {
    side: 'home',
    label: 'Boston Celtics',
    bookmaker: 'fanduel',
    odds: -130,
    line: null,
    stake: 585.58,
    toWin: 450.45,
  },
];

export function makeArbitrageOpportunity(
  overrides: Partial<ArbitrageOpportunity> = {}
): ArbitrageOpportunity {
  return {
    id: 'arb-1',
    gameId: 'game-lal-bos',
    detectedAt: iso(-2),
    expiresAt: iso(8),
    arbType: 'two-way',
    marketType: 'h2h',
    profitPercentage: '3.60',
    stake: '1000.00',
    expectedProfit: '36.03',
    legs: ARB_LEGS,
    middleProbability: null,
    middleGapLow: null,
    middleGapHigh: null,
    riskLevel: 'low',
    riskFactors: [],
    limitRisk: false,
    oddsDrift: null,
    oddsSnapshotAge: 45,
    status: 'active',
    takenAt: null,
    userId: null,
    actualProfit: null,
    game: {
      id: 'game-lal-bos',
      homeTeamName: 'Boston Celtics',
      awayTeamName: 'Los Angeles Lakers',
      commenceTime: iso(120),
      status: 'scheduled',
      sport: { key: 'basketball_nba', name: 'NBA Basketball' },
    },
    ...overrides,
  };
}

export const ARBITRAGE_STATS: ArbitrageStats = {
  periodDays: 30,
  totalDetected: 128,
  activeNow: 4,
  detectionsPerDay: 4.27,
  averageProfitPercentage: 2.14,
  bestProfitPercentage: 7.82,
  averageSnapshotAgeSeconds: 62,
  taken: {
    count: 9,
    expectedProfit: 412.5,
    actualProfit: 389.15,
  },
  byType: {
    'two-way': { count: 96, averageProfitPercentage: 1.95 },
    middle: { count: 32, averageProfitPercentage: 2.71 },
  },
  byStatus: { active: 4, expired: 115, taken: 9 },
};

/** Matches ARB_LEGS: same odds, same $1,000 stake, same derived figures. */
export const STAKE_PLAN: StakePlan = {
  odds: [150, -130],
  totalStake: 1000,
  stakes: [414.42, 585.58],
  payouts: [1036.05, 1036.03],
  totalImpliedProbability: 0.9652,
  guaranteedProfit: 36.03,
  profitPercentage: 3.6,
  isArbitrage: true,
};

// ─── Sharp money ──────────────────────────────────────────────────────────────

export function makeSharpIndicator(overrides: Partial<SharpIndicator> = {}): SharpIndicator {
  return {
    id: 'sharp-1',
    gameId: 'game-lal-bos',
    marketType: 'spreads',
    calculatedAt: iso(-15),
    lineMovement: 'reverse',
    sharpSide: 'away',
    publicSide: 'home',
    sharpConfidence: 8,
    contraindicators: [],
    publicBettingPct: 72,
    publicMoneyPct: 38,
    game: {
      id: 'game-lal-bos',
      homeTeamName: 'Boston Celtics',
      awayTeamName: 'Los Angeles Lakers',
      commenceTime: iso(120),
      sport: { key: 'basketball_nba', name: 'NBA Basketball' },
    },
    ...overrides,
  };
}

export function makeContrarianOpportunity(
  overrides: Partial<ContrarianOpportunity> = {}
): ContrarianOpportunity {
  return {
    gameId: 'game-lal-bos',
    homeTeamName: 'Boston Celtics',
    awayTeamName: 'Los Angeles Lakers',
    commenceTime: iso(120),
    sportKey: 'basketball_nba',
    indicators: [makeSharpIndicator()],
    maxConfidence: 8,
    ...overrides,
  };
}

/** byMarket/bySharpSide/byLineMovement each sum to totalIndicators (41). */
export const SHARP_STATS: SharpStats = {
  byMarket: { h2h: 12, spreads: 21, totals: 8 },
  bySharpSide: { home: 14, away: 17, over: 6, under: 4 },
  byLineMovement: { steam: 9, reverse: 11, gradual: 15, no_movement: 6 },
  avgConfidence: 6.4,
  totalIndicators: 41,
  period: 'Last 24 hours',
};

// ─── Line movement ────────────────────────────────────────────────────────────

export function makeLineMovement(overrides: Partial<LineMovement> = {}): LineMovement {
  return {
    id: 'move-1',
    gameId: 'game-lal-bos',
    marketType: 'spreads',
    detectedAt: iso(-8),
    movementType: 'steam',
    linesBefore: { draftkings: -3.5, fanduel: -3.5, betmgm: -3 },
    linesAfter: { draftkings: -5, fanduel: -5, betmgm: -4.5 },
    bookmakerCount: 3,
    // Decimal columns arrive as strings over the wire; keep that shape so
    // consumers that must coerce are actually exercised.
    averageMovement: '1.50',
    timeToMove: 180,
    maxMovement: '1.50',
    suspectedCause: null,
    game: {
      id: 'game-lal-bos',
      homeTeamName: 'Boston Celtics',
      awayTeamName: 'Los Angeles Lakers',
      commenceTime: iso(120),
      status: 'scheduled',
      sportKey: 'basketball_nba',
      sportName: 'NBA Basketball',
    },
    ...overrides,
  };
}

/** byType and byMarket both sum to 60. */
export const MOVEMENT_STATS: MovementStats = {
  byType: { steam: 11, reverse: 7, gradual: 26, injury: 3, normal: 13 },
  byMarket: { h2h: 18, spreads: 29, totals: 13 },
};

// ─── Bookmakers ───────────────────────────────────────────────────────────────

export function makeBookmakerAnalytics(
  overrides: Partial<BookmakerAnalytics> = {}
): BookmakerAnalytics {
  return {
    bookmaker: 'pinnacle',
    sharpBookRating: 9.4,
    bestOddsFrequency: 41.2,
    marginVsConsensus: 0.8,
    outlierFrequency: 6.1,
    firstMoverFrequency: 62.5,
    lineMovementLag: 12,
    marketEfficiency: 94,
    uptimePercentage: 99.1,
    oddsUpdateFrequency: 45,
    averageOddsAge: 22,
    limitProfile: 'high',
    estimatedMaxBet: 25000,
    recommendationScore: 91,
    sportsCovered: ['basketball_nba', 'americanfootball_nfl'],
    marketsCovered: ['h2h', 'spreads', 'totals'],
    totalGamesOffered: 412,
    totalMarketsOffered: 1236,
    averageCLVOffered: 1.8,
    calculatedAt: iso(-60),
    updatedAt: iso(-60),
    ...overrides,
  };
}

export const BOOKMAKER_OUTLIER_STATS: BookmakerOutlierStats = {
  bookmaker: 'pinnacle',
  totalRecords: 1236,
  outlierCount: 75,
  outlierRate: 6.07,
  avgDeviation: 1.9,
  days: 30,
};

// ─── CLV ──────────────────────────────────────────────────────────────────────

/** positive + negative + neutral === totalBets (140). */
export const CLV_SUMMARY: CLVSummary = {
  totalBets: 140,
  averageCLV: 1.85,
  positiveCLVCount: 82,
  negativeCLVCount: 46,
  neutralCLVCount: 12,
  clvWinRate: 58.6,
  expectedROI: 4.2,
  actualROI: 3.1,
};

export const CLV_BY_SPORT: CLVBySport[] = [
  {
    sport: 'basketball_nba',
    sportName: 'NBA Basketball',
    totalBets: 90,
    averageCLV: 2.4,
    positiveCLVCount: 56,
    negativeCLVCount: 34,
    clvWinRate: 62.2,
  },
  {
    sport: 'americanfootball_nfl',
    sportName: 'NFL',
    totalBets: 50,
    averageCLV: 0.86,
    positiveCLVCount: 26,
    negativeCLVCount: 24,
    clvWinRate: 52,
  },
];

export const CLV_BY_BOOKMAKER: CLVByBookmaker[] = [
  {
    bookmaker: 'draftkings',
    totalBets: 78,
    averageCLV: 2.1,
    positiveCLVCount: 48,
    negativeCLVCount: 30,
    clvWinRate: 61.5,
  },
  {
    bookmaker: 'fanduel',
    totalBets: 62,
    averageCLV: 1.5,
    positiveCLVCount: 34,
    negativeCLVCount: 28,
    clvWinRate: 54.8,
  },
];

export const CLV_TRENDS: CLVTrend[] = [
  { date: '2026-01-12', averageCLV: 1.2, betCount: 18, winRate: 55.6 },
  { date: '2026-01-13', averageCLV: 2.4, betCount: 22, winRate: 63.6 },
  { date: '2026-01-14', averageCLV: -0.6, betCount: 15, winRate: 46.7 },
];

// ─── Response envelopes ───────────────────────────────────────────────────────

/** `{ success: true, data }` — arbitrage, sharp, bookmaker, clv, correlation. */
export function successEnvelope<T>(data: T) {
  return { data: { success: true, data } };
}

/** `{ status: 'success', data }` — the movements routes use this variant. */
export function movementEnvelope<T>(data: T) {
  return { data: { status: 'success', data } };
}

/** An axios rejection shaped the way the slices' error handlers read it. */
export function axiosError(message: string, status = 500) {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { success: false, error: message } },
  });
}
