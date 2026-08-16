/**
 * Arbitrage & Middle Detection Service
 *
 * Detects arbitrage opportunities (guaranteed profit by betting every side of a
 * market across different bookmakers) and middle opportunities (a gap between
 * two lines where both legs can win) from the `CurrentOdds` snapshot.
 *
 * Freshness caveat: odds are refreshed by `sync-odds.job` on a configurable
 * cadence (~10 minutes by default). Every opportunity therefore carries an
 * `oddsSnapshotAge` in seconds so the UI can show how stale the underlying
 * snapshot is. See docs/internal/adr-019-arbitrage-sync-cadence.md.
 */

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import {
  americanToDecimal,
  calculateImpliedProbability,
} from '../utils/odds-calculator';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArbMarketType = 'h2h' | 'spreads' | 'totals';
export type ArbType = 'two-way' | 'three-way' | 'middle';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ArbSide = 'home' | 'away' | 'over' | 'under' | 'draw';

export interface ArbLeg {
  side: ArbSide;
  label: string;
  bookmaker: string;
  odds: number;
  line: number | null;
  stake: number;
  toWin: number;
}

/** Minimal shape of a `CurrentOdds` row used by the pure detection helpers. */
export interface OddsRow {
  bookmaker: string;
  marketType: string;
  homePrice: number | null;
  awayPrice: number | null;
  homeSpread: number | null;
  homeSpreadPrice: number | null;
  awaySpread: number | null;
  awaySpreadPrice: number | null;
  totalLine: number | null;
  overPrice: number | null;
  underPrice: number | null;
  lastUpdated: Date;
}

export interface DetectionContext {
  homeTeamName?: string;
  awayTeamName?: string;
  sportKey?: string;
  totalStake?: number;
  /** Allow both legs to sit on the same bookmaker. Off by default. */
  allowSameBookmaker?: boolean;
}

export interface DetectedOpportunity {
  arbType: ArbType;
  marketType: ArbMarketType;
  profitPercentage: number;
  stake: number;
  expectedProfit: number;
  legs: ArbLeg[];
  /** Seconds since the oldest leg in this opportunity was last synced. */
  oddsSnapshotAge: number;
  middleProbability?: number;
  middleGapLow?: number;
  middleGapHigh?: number;
}

export interface RiskInput {
  profitPercentage: number;
  oddsSnapshotAge: number;
  oddsDrift: number | null;
  minutesToStart: number;
  bookmakers: string[];
  limitProfiles?: Record<string, string | null | undefined>;
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  factors: string[];
  limitRisk: boolean;
}

export interface StakePlan {
  odds: number[];
  totalStake: number;
  stakes: number[];
  payouts: number[];
  totalImpliedProbability: number;
  guaranteedProfit: number;
  profitPercentage: number;
  isArbitrage: boolean;
}

export interface ScanResult {
  gamesScanned: number;
  opportunitiesFound: number;
  opportunitiesCreated: number;
  opportunitiesRefreshed: number;
  expired: number;
  durationMs: number;
  errors: string[];
}

// ─── Configuration ────────────────────────────────────────────────────────────

const MIN_PROFIT_PERCENTAGE = parseFloat(env.ARBITRAGE_MIN_PROFIT_PCT) || 0.5;
const DEFAULT_TOTAL_STAKE = parseFloat(env.ARBITRAGE_DEFAULT_STAKE) || 1000;
const OPPORTUNITY_TTL_SECONDS = parseInt(env.ARBITRAGE_TTL_SECONDS, 10) || 600;
const MIN_MIDDLE_PROBABILITY = parseFloat(env.ARBITRAGE_MIN_MIDDLE_PROBABILITY) || 0.10;

/** Minimum gap, in points, before a spread/total pair counts as a middle. */
const MIN_MIDDLE_GAP = 2.0;

/** Profit above this is treated as a data error rather than free money. */
const SUSPICIOUS_PROFIT_PCT = 10.0;

/** Snapshot older than this (seconds) downgrades confidence. */
const STALE_SNAPSHOT_SECONDS = 300;

/** Odds drift above this percentage marks the market as fast moving. */
const FAST_MOVING_DRIFT_PCT = 5.0;

/** Bookmaker limit profiles that make an account restriction likely. */
const RESTRICTIVE_LIMIT_PROFILES = ['low', 'tight', 'restrictive'];

/**
 * Standard deviation of the final margin (spreads) and of the final combined
 * score (totals), by sport group. Used to estimate how often a middle lands.
 * These are rough historical values and only drive a probability estimate.
 */
const MARGIN_SIGMA: Record<string, number> = {
  americanfootball: 13.5,
  basketball: 11.5,
  baseball: 4.4,
  icehockey: 2.2,
  soccer: 1.7,
};

const TOTAL_SIGMA: Record<string, number> = {
  americanfootball: 10.5,
  basketball: 12.0,
  baseball: 3.2,
  icehockey: 1.9,
  soccer: 1.3,
};

const DEFAULT_MARGIN_SIGMA = 10.0;
const DEFAULT_TOTAL_SIGMA = 9.0;

// ─── Small helpers ────────────────────────────────────────────────────────────

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Normal CDF via the Abramowitz & Stegun erf approximation. */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function sigmaFor(sportKey: string | undefined, kind: 'margin' | 'total'): number {
  const table = kind === 'margin' ? MARGIN_SIGMA : TOTAL_SIGMA;
  const fallback = kind === 'margin' ? DEFAULT_MARGIN_SIGMA : DEFAULT_TOTAL_SIGMA;
  if (!sportKey) return fallback;
  const group = sportKey.split('_')[0];
  return table[group] ?? fallback;
}

/** Convert a Prisma `CurrentOdds` row (Decimal fields) into a plain `OddsRow`. */
export function toOddsRow(row: any): OddsRow {
  return {
    bookmaker: row.bookmaker,
    marketType: row.marketType,
    homePrice: toNumber(row.homePrice),
    awayPrice: toNumber(row.awayPrice),
    homeSpread: toNumber(row.homeSpread),
    homeSpreadPrice: toNumber(row.homeSpreadPrice),
    awaySpread: toNumber(row.awaySpread),
    awaySpreadPrice: toNumber(row.awaySpreadPrice),
    totalLine: toNumber(row.totalLine),
    overPrice: toNumber(row.overPrice),
    underPrice: toNumber(row.underPrice),
    lastUpdated: row.lastUpdated instanceof Date ? row.lastUpdated : new Date(row.lastUpdated),
  };
}

function ageSeconds(rows: Array<{ lastUpdated: Date }>, now: Date): number {
  if (rows.length === 0) return 0;
  const oldest = Math.min(...rows.map((r) => r.lastUpdated.getTime()));
  return Math.max(0, Math.round((now.getTime() - oldest) / 1000));
}

// ─── Stake mathematics ────────────────────────────────────────────────────────

/**
 * Split a total stake across legs so that every leg returns the same amount.
 *
 * @param odds       American odds, one per leg
 * @param totalStake Total amount to distribute
 * @returns Stake per leg, rounded to cents
 */
export function calculateOptimalStakes(odds: number[], totalStake: number): number[] {
  if (!Array.isArray(odds) || odds.length === 0) {
    throw new Error('At least one leg is required');
  }
  if (!(totalStake > 0)) {
    throw new Error('Total stake must be positive');
  }

  const probabilities = odds.map(calculateImpliedProbability);
  const totalProbability = probabilities.reduce((sum, p) => sum + p, 0);

  if (totalProbability <= 0) {
    throw new Error('Invalid odds produced a non positive implied probability');
  }

  return probabilities.map((p) => round2((p / totalProbability) * totalStake));
}

/**
 * Build a full stake plan for a set of legs. Used by the calculator endpoint
 * and internally when persisting a detected opportunity.
 */
export function buildStakePlan(odds: number[], totalStake: number): StakePlan {
  const stakes = calculateOptimalStakes(odds, totalStake);
  const payouts = stakes.map((stake, i) => round2(stake * americanToDecimal(odds[i])));
  const totalImpliedProbability = odds.reduce((sum, o) => sum + calculateImpliedProbability(o), 0);

  // Worst case return across legs, so the "guaranteed" figure stays honest
  // after cent rounding.
  const worstPayout = Math.min(...payouts);
  const stakedTotal = round2(stakes.reduce((sum, s) => sum + s, 0));
  const guaranteedProfit = round2(worstPayout - stakedTotal);

  return {
    odds,
    totalStake: stakedTotal,
    stakes,
    payouts,
    totalImpliedProbability: round4(totalImpliedProbability),
    guaranteedProfit,
    profitPercentage: round2((guaranteedProfit / stakedTotal) * 100),
    isArbitrage: totalImpliedProbability < 1,
  };
}

// ─── Market field selectors ───────────────────────────────────────────────────

interface SidePrice {
  row: OddsRow;
  price: number;
  line: number | null;
}

function homeSideCandidates(rows: OddsRow[], marketType: ArbMarketType): SidePrice[] {
  const out: SidePrice[] = [];
  for (const row of rows) {
    if (marketType === 'h2h' && row.homePrice !== null) {
      out.push({ row, price: row.homePrice, line: null });
    } else if (
      marketType === 'spreads' &&
      row.homeSpreadPrice !== null &&
      row.homeSpread !== null
    ) {
      out.push({ row, price: row.homeSpreadPrice, line: row.homeSpread });
    } else if (marketType === 'totals' && row.overPrice !== null && row.totalLine !== null) {
      out.push({ row, price: row.overPrice, line: row.totalLine });
    }
  }
  return out;
}

function awaySideCandidates(rows: OddsRow[], marketType: ArbMarketType): SidePrice[] {
  const out: SidePrice[] = [];
  for (const row of rows) {
    if (marketType === 'h2h' && row.awayPrice !== null) {
      out.push({ row, price: row.awayPrice, line: null });
    } else if (
      marketType === 'spreads' &&
      row.awaySpreadPrice !== null &&
      row.awaySpread !== null
    ) {
      out.push({ row, price: row.awaySpreadPrice, line: row.awaySpread });
    } else if (marketType === 'totals' && row.underPrice !== null && row.totalLine !== null) {
      out.push({ row, price: row.underPrice, line: row.totalLine });
    }
  }
  return out;
}

function sideNames(marketType: ArbMarketType): [ArbSide, ArbSide] {
  return marketType === 'totals' ? ['over', 'under'] : ['home', 'away'];
}

function legLabel(
  side: ArbSide,
  line: number | null,
  ctx: DetectionContext
): string {
  const signed = line === null ? '' : ` ${line > 0 ? '+' : ''}${line}`;
  switch (side) {
    case 'home':
      return `${ctx.homeTeamName ?? 'Home'}${signed}`;
    case 'away':
      return `${ctx.awayTeamName ?? 'Away'}${signed}`;
    case 'over':
      return `Over${line === null ? '' : ` ${line}`}`;
    case 'under':
      return `Under${line === null ? '' : ` ${line}`}`;
    default:
      return side;
  }
}

/**
 * Are these two lines compatible for a combined position?
 *
 * Spreads: home at `-3.5` and away at `+3.5` sum to 0 (complementary). A
 * positive sum is a gap in the bettor's favour (a middle), a negative sum is a
 * gap against the bettor and must be rejected.
 *
 * Totals: over must sit at or below under, otherwise there is a band where
 * neither leg wins.
 *
 * The spec's original pseudocode compared best prices without checking lines,
 * which reports false arbitrage whenever books disagree on the line. This
 * check is the correction.
 */
export function linesAreCompatible(
  marketType: ArbMarketType,
  homeLine: number | null,
  awayLine: number | null
): boolean {
  if (marketType === 'h2h') return true;
  if (homeLine === null || awayLine === null) return false;
  if (marketType === 'spreads') return homeLine + awayLine >= 0;
  // totals: over line <= under line
  return homeLine <= awayLine;
}

/** Gap between the two lines, in points. Zero means complementary lines. */
export function lineGap(
  marketType: ArbMarketType,
  homeLine: number | null,
  awayLine: number | null
): number {
  if (marketType === 'h2h' || homeLine === null || awayLine === null) return 0;
  if (marketType === 'spreads') return homeLine + awayLine;
  return awayLine - homeLine;
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Detect the best two-way arbitrage across bookmakers for a single market.
 *
 * Considers every (side A book, side B book) pairing whose lines are
 * compatible and keeps the one with the lowest combined implied probability.
 */
export function detectTwoWayArbitrage(
  rows: OddsRow[],
  marketType: ArbMarketType,
  ctx: DetectionContext = {}
): DetectedOpportunity | null {
  const relevant = rows.filter((r) => r.marketType === marketType);
  if (relevant.length < 2) return null;

  const homeCandidates = homeSideCandidates(relevant, marketType);
  const awayCandidates = awaySideCandidates(relevant, marketType);
  if (homeCandidates.length === 0 || awayCandidates.length === 0) return null;

  const totalStake = ctx.totalStake ?? DEFAULT_TOTAL_STAKE;
  const allowSameBook = ctx.allowSameBookmaker ?? false;

  let best: { a: SidePrice; b: SidePrice; totalProbability: number } | null = null;

  for (const a of homeCandidates) {
    for (const b of awayCandidates) {
      if (!allowSameBook && a.row.bookmaker === b.row.bookmaker) continue;
      if (!linesAreCompatible(marketType, a.line, b.line)) continue;

      const totalProbability =
        calculateImpliedProbability(a.price) + calculateImpliedProbability(b.price);

      if (totalProbability >= 1) continue;
      if (!best || totalProbability < best.totalProbability) {
        best = { a, b, totalProbability };
      }
    }
  }

  if (!best) return null;

  const profitPercentage = round2((1 / best.totalProbability - 1) * 100);
  if (profitPercentage < MIN_PROFIT_PERCENTAGE) return null;

  const [sideA, sideB] = sideNames(marketType);
  const plan = buildStakePlan([best.a.price, best.b.price], totalStake);

  const legs: ArbLeg[] = [
    {
      side: sideA,
      label: legLabel(sideA, best.a.line, ctx),
      bookmaker: best.a.row.bookmaker,
      odds: best.a.price,
      line: best.a.line,
      stake: plan.stakes[0],
      toWin: plan.payouts[0],
    },
    {
      side: sideB,
      label: legLabel(sideB, best.b.line, ctx),
      bookmaker: best.b.row.bookmaker,
      odds: best.b.price,
      line: best.b.line,
      stake: plan.stakes[1],
      toWin: plan.payouts[1],
    },
  ];

  return {
    arbType: 'two-way',
    marketType,
    profitPercentage,
    stake: plan.totalStake,
    expectedProfit: plan.guaranteedProfit,
    legs,
    oddsSnapshotAge: ageSeconds([best.a.row, best.b.row], new Date()),
  };
}

/**
 * Probability that the result lands strictly inside a middle window.
 *
 * The market's own two lines bracket its expectation, so the outcome is
 * modelled as normal around the midpoint of the gap.
 */
export function estimateMiddleProbability(
  gapLow: number,
  gapHigh: number,
  sigma: number
): number {
  if (!(gapHigh > gapLow) || !(sigma > 0)) return 0;
  const halfGap = (gapHigh - gapLow) / 2;
  return round4(2 * normalCdf(halfGap / sigma) - 1);
}

/**
 * Detect the best middle: two lines with a gap where both legs can win.
 *
 * Spreads: home covers when `margin > -homeLine`, away covers when
 * `margin < awayLine`, so both win on `(-homeLine, awayLine)`.
 * Totals: both win when the score lands in `(overLine, underLine)`.
 */
export function detectMiddle(
  rows: OddsRow[],
  marketType: 'spreads' | 'totals',
  ctx: DetectionContext = {}
): DetectedOpportunity | null {
  const relevant = rows.filter((r) => r.marketType === marketType);
  if (relevant.length < 2) return null;

  const homeCandidates = homeSideCandidates(relevant, marketType);
  const awayCandidates = awaySideCandidates(relevant, marketType);
  if (homeCandidates.length === 0 || awayCandidates.length === 0) return null;

  const totalStake = ctx.totalStake ?? DEFAULT_TOTAL_STAKE;
  const allowSameBook = ctx.allowSameBookmaker ?? false;
  const sigma = sigmaFor(ctx.sportKey, marketType === 'spreads' ? 'margin' : 'total');

  let best: {
    a: SidePrice;
    b: SidePrice;
    gap: number;
    probability: number;
    expectedValue: number;
    plan: StakePlan;
    gapLow: number;
    gapHigh: number;
  } | null = null;

  for (const a of homeCandidates) {
    for (const b of awayCandidates) {
      if (!allowSameBook && a.row.bookmaker === b.row.bookmaker) continue;
      if (a.line === null || b.line === null) continue;

      const gap = lineGap(marketType, a.line, b.line);
      if (gap < MIN_MIDDLE_GAP) continue;

      // Spreads: home covers above -homeLine, away covers below awayLine.
      // Totals: both win between the over line and the under line.
      const gapLow = marketType === 'spreads' ? -a.line : a.line;
      const gapHigh = b.line;

      const probability = estimateMiddleProbability(gapLow, gapHigh, sigma);
      if (probability < MIN_MIDDLE_PROBABILITY) continue;

      const plan = buildStakePlan([a.price, b.price], totalStake);
      // Exactly one leg wins outside the middle; both win inside it.
      const profitOneWin = plan.guaranteedProfit;
      const profitBothWin = round2(
        plan.payouts[0] + plan.payouts[1] - plan.totalStake
      );
      const expectedValue = round2(
        probability * profitBothWin + (1 - probability) * profitOneWin
      );

      if (expectedValue <= 0) continue;
      if (!best || expectedValue > best.expectedValue) {
        best = { a, b, gap, probability, expectedValue, plan, gapLow, gapHigh };
      }
    }
  }

  if (!best) return null;

  const [sideA, sideB] = sideNames(marketType);
  const legs: ArbLeg[] = [
    {
      side: sideA,
      label: legLabel(sideA, best.a.line, ctx),
      bookmaker: best.a.row.bookmaker,
      odds: best.a.price,
      line: best.a.line,
      stake: best.plan.stakes[0],
      toWin: best.plan.payouts[0],
    },
    {
      side: sideB,
      label: legLabel(sideB, best.b.line, ctx),
      bookmaker: best.b.row.bookmaker,
      odds: best.b.price,
      line: best.b.line,
      stake: best.plan.stakes[1],
      toWin: best.plan.payouts[1],
    },
  ];

  return {
    arbType: 'middle',
    marketType,
    // For a middle the headline number is expected return, not a guarantee.
    profitPercentage: round2((best.expectedValue / best.plan.totalStake) * 100),
    stake: best.plan.totalStake,
    expectedProfit: best.expectedValue,
    legs,
    oddsSnapshotAge: ageSeconds([best.a.row, best.b.row], new Date()),
    middleProbability: best.probability,
    middleGapLow: best.gapLow,
    middleGapHigh: best.gapHigh,
  };
}

// ─── Risk assessment ──────────────────────────────────────────────────────────

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function escalate(current: RiskLevel, candidate: RiskLevel): RiskLevel {
  return RISK_ORDER[candidate] > RISK_ORDER[current] ? candidate : current;
}

export function estimateLimitRisk(input: RiskInput): boolean {
  // Both legs at the same book is the fastest way to get flagged.
  const uniqueBooks = new Set(input.bookmakers);
  if (uniqueBooks.size < input.bookmakers.length) return true;

  // Books known to cut limits aggressively.
  for (const book of uniqueBooks) {
    const profile = (input.limitProfiles?.[book] ?? '').toLowerCase();
    if (RESTRICTIVE_LIMIT_PROFILES.includes(profile)) return true;
  }

  // Large edges get noticed.
  return input.profitPercentage > 4.0;
}

export function assessRisk(input: RiskInput): RiskAssessment {
  let riskLevel: RiskLevel = 'low';
  const factors: string[] = [];

  if (input.oddsSnapshotAge > STALE_SNAPSHOT_SECONDS) {
    riskLevel = escalate(riskLevel, 'medium');
    factors.push(
      `Odds may be stale (${Math.round(input.oddsSnapshotAge / 60)} min since last sync)`
    );
  }

  if ((input.oddsDrift ?? 0) > FAST_MOVING_DRIFT_PCT) {
    riskLevel = escalate(riskLevel, 'medium');
    factors.push('Fast moving odds');
  }

  if (input.profitPercentage > SUSPICIOUS_PROFIT_PCT) {
    riskLevel = escalate(riskLevel, 'high');
    factors.push('Suspiciously high profit, verify the lines manually');
  }

  if (input.minutesToStart < 15) {
    riskLevel = escalate(riskLevel, 'medium');
    factors.push('Very close to start time');
  }

  const limitRisk = estimateLimitRisk(input);
  if (limitRisk) {
    factors.push('Account limit risk, spread the legs across different books');
  }

  return { riskLevel, factors, limitRisk };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ArbitrageService {
  /**
   * Scan every upcoming game that has odds from more than one bookmaker,
   * persist the opportunities found, and expire anything past its TTL.
   */
  async scanForArbitrage(): Promise<ScanResult> {
    const startedAt = Date.now();
    const now = new Date();
    const errors: string[] = [];

    let opportunitiesFound = 0;
    let opportunitiesCreated = 0;
    let opportunitiesRefreshed = 0;

    const expired = await this.expireStaleOpportunities();

    const games = await prisma.game.findMany({
      where: {
        status: 'scheduled',
        commenceTime: { gt: now },
        currentOdds: { some: {} },
      },
      select: {
        id: true,
        homeTeamName: true,
        awayTeamName: true,
        commenceTime: true,
        sport: { select: { key: true } },
        currentOdds: {
          select: {
            bookmaker: true,
            marketType: true,
            homePrice: true,
            awayPrice: true,
            homeSpread: true,
            homeSpreadPrice: true,
            awaySpread: true,
            awaySpreadPrice: true,
            totalLine: true,
            overPrice: true,
            underPrice: true,
            lastUpdated: true,
          },
        },
      },
    });

    const limitProfiles = await this.getLimitProfiles();
    let gamesScanned = 0;

    for (const game of games) {
      const rows = game.currentOdds.map(toOddsRow);
      const bookmakers = new Set(rows.map((r) => r.bookmaker));
      if (bookmakers.size < 2) continue;

      gamesScanned++;

      const ctx: DetectionContext = {
        homeTeamName: game.homeTeamName,
        awayTeamName: game.awayTeamName,
        sportKey: game.sport?.key,
        totalStake: DEFAULT_TOTAL_STAKE,
      };

      const candidates: DetectedOpportunity[] = [
        detectTwoWayArbitrage(rows, 'h2h', ctx),
        detectTwoWayArbitrage(rows, 'spreads', ctx),
        detectTwoWayArbitrage(rows, 'totals', ctx),
        detectMiddle(rows, 'spreads', ctx),
        detectMiddle(rows, 'totals', ctx),
      ].filter((c): c is DetectedOpportunity => c !== null);

      if (candidates.length === 0) continue;

      const minutesToStart = Math.round(
        (game.commenceTime.getTime() - now.getTime()) / 60000
      );

      for (const candidate of candidates) {
        opportunitiesFound++;
        try {
          const oddsDrift = await this.calculateOddsDrift(game.id, candidate.marketType);
          const risk = assessRisk({
            profitPercentage: candidate.profitPercentage,
            oddsSnapshotAge: candidate.oddsSnapshotAge,
            oddsDrift,
            minutesToStart,
            bookmakers: candidate.legs.map((l) => l.bookmaker),
            limitProfiles,
          });

          const expiresAt = new Date(
            Math.min(
              now.getTime() + OPPORTUNITY_TTL_SECONDS * 1000,
              game.commenceTime.getTime()
            )
          );

          const { record, isNew } = await this.persistOpportunity(
            game.id,
            candidate,
            risk,
            oddsDrift,
            expiresAt
          );

          if (isNew) {
            opportunitiesCreated++;
            await this.notifyUsers(record);
          } else {
            opportunitiesRefreshed++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`Game ${game.id} (${candidate.marketType}/${candidate.arbType}): ${message}`);
        }
      }
    }

    return {
      gamesScanned,
      opportunitiesFound,
      opportunitiesCreated,
      opportunitiesRefreshed,
      expired,
      durationMs: Date.now() - startedAt,
      errors,
    };
  }

  /** Mark every active opportunity past its expiry as expired. */
  async expireStaleOpportunities(): Promise<number> {
    const result = await prisma.arbitrageOpportunity.updateMany({
      where: { status: 'active', expiresAt: { lte: new Date() } },
      data: { status: 'expired' },
    });
    return result.count;
  }

  /**
   * v1 notification delivery is in-app only: the row itself is the alert and
   * the dashboard/notifications page polls `/api/analytics/arbitrage/live`.
   * Push, email, SMS and webhook delivery are a separate prerequisite issue.
   */
  async notifyUsers(opportunity: any): Promise<void> {
    logger.info(
      `💰 Arbitrage ${opportunity.arbType} on ${opportunity.marketType}: ` +
        `${Number(opportunity.profitPercentage).toFixed(2)}% ` +
        `(risk ${opportunity.riskLevel}, snapshot ${opportunity.oddsSnapshotAge}s old)`
    );
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  async getLiveOpportunities(options: {
    limit?: number;
    minProfit?: number;
    arbType?: ArbType;
    marketType?: ArbMarketType;
    maxSnapshotAge?: number;
  } = {}) {
    const limit = options.limit ?? 25;

    return prisma.arbitrageOpportunity.findMany({
      where: {
        status: 'active',
        expiresAt: { gt: new Date() },
        ...(options.minProfit !== undefined
          ? { profitPercentage: { gte: options.minProfit } }
          : {}),
        ...(options.arbType ? { arbType: options.arbType } : {}),
        ...(options.marketType ? { marketType: options.marketType } : {}),
        ...(options.maxSnapshotAge !== undefined
          ? { oddsSnapshotAge: { lte: options.maxSnapshotAge } }
          : {}),
      },
      include: {
        game: {
          select: {
            id: true,
            homeTeamName: true,
            awayTeamName: true,
            commenceTime: true,
            status: true,
            sport: { select: { key: true, name: true } },
          },
        },
      },
      orderBy: [{ profitPercentage: 'desc' }, { detectedAt: 'desc' }],
      take: limit,
    });
  }

  async getHistory(options: {
    limit?: number;
    daysBack?: number;
    status?: string;
    userId?: string;
  } = {}) {
    const limit = options.limit ?? 50;
    const daysBack = options.daysBack ?? 7;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    return prisma.arbitrageOpportunity.findMany({
      where: {
        detectedAt: { gte: since },
        ...(options.status ? { status: options.status } : {}),
        ...(options.userId ? { userId: options.userId } : {}),
      },
      include: {
        game: {
          select: {
            id: true,
            homeTeamName: true,
            awayTeamName: true,
            commenceTime: true,
            sport: { select: { key: true, name: true } },
          },
        },
      },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
  }

  async getById(id: string) {
    return prisma.arbitrageOpportunity.findUnique({
      where: { id },
      include: {
        game: {
          select: {
            id: true,
            homeTeamName: true,
            awayTeamName: true,
            commenceTime: true,
            status: true,
            sport: { select: { key: true, name: true } },
          },
        },
      },
    });
  }

  /** Record that a user actually placed the opportunity. */
  async markTaken(id: string, userId?: string, actualProfit?: number) {
    const existing = await prisma.arbitrageOpportunity.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.arbitrageOpportunity.update({
      where: { id },
      data: {
        status: 'taken',
        takenAt: new Date(),
        ...(userId ? { userId } : {}),
        ...(actualProfit !== undefined ? { actualProfit } : {}),
      },
    });
  }

  async getStats(options: { daysBack?: number; userId?: string } = {}) {
    const daysBack = options.daysBack ?? 30;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const scope = {
      detectedAt: { gte: since },
      ...(options.userId ? { userId: options.userId } : {}),
    };

    const [byType, byStatus, aggregate, takenAggregate, activeCount] = await Promise.all([
      prisma.arbitrageOpportunity.groupBy({
        by: ['arbType'],
        where: scope,
        _count: { _all: true },
        _avg: { profitPercentage: true },
      }),
      prisma.arbitrageOpportunity.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
      prisma.arbitrageOpportunity.aggregate({
        where: scope,
        _count: { _all: true },
        _avg: { profitPercentage: true, oddsSnapshotAge: true },
        _max: { profitPercentage: true },
      }),
      prisma.arbitrageOpportunity.aggregate({
        where: { ...scope, status: 'taken' },
        _count: { _all: true },
        _sum: { actualProfit: true, expectedProfit: true },
      }),
      prisma.arbitrageOpportunity.count({
        where: { status: 'active', expiresAt: { gt: new Date() } },
      }),
    ]);

    const totalDetected = aggregate._count._all;

    return {
      periodDays: daysBack,
      totalDetected,
      activeNow: activeCount,
      detectionsPerDay: round2(totalDetected / daysBack),
      averageProfitPercentage: round2(Number(aggregate._avg.profitPercentage ?? 0)),
      bestProfitPercentage: round2(Number(aggregate._max.profitPercentage ?? 0)),
      averageSnapshotAgeSeconds: Math.round(Number(aggregate._avg.oddsSnapshotAge ?? 0)),
      taken: {
        count: takenAggregate._count._all,
        expectedProfit: round2(Number(takenAggregate._sum.expectedProfit ?? 0)),
        actualProfit: round2(Number(takenAggregate._sum.actualProfit ?? 0)),
      },
      byType: Object.fromEntries(
        byType.map((row) => [
          row.arbType,
          {
            count: row._count._all,
            averageProfitPercentage: round2(Number(row._avg.profitPercentage ?? 0)),
          },
        ])
      ),
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
    };
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  /**
   * Percentage change in the best implied probability for a market over the
   * last 30 minutes. Used as a "how fast is this market moving" signal.
   */
  private async calculateOddsDrift(
    gameId: string,
    marketType: ArbMarketType
  ): Promise<number | null> {
    const since = new Date(Date.now() - 30 * 60 * 1000);

    const snapshots = await prisma.oddsSnapshot.findMany({
      where: { gameId, marketType, capturedAt: { gte: since } },
      orderBy: { capturedAt: 'asc' },
      select: {
        homePrice: true,
        homeSpreadPrice: true,
        overPrice: true,
        capturedAt: true,
      },
    });

    if (snapshots.length < 2) return null;

    const priceOf = (snapshot: any): number | null => {
      if (marketType === 'h2h') return toNumber(snapshot.homePrice);
      if (marketType === 'spreads') return toNumber(snapshot.homeSpreadPrice);
      return toNumber(snapshot.overPrice);
    };

    const prices = snapshots.map(priceOf).filter((p): p is number => p !== null);
    if (prices.length < 2) return null;

    const first = calculateImpliedProbability(prices[0]);
    const last = calculateImpliedProbability(prices[prices.length - 1]);
    if (first === 0) return null;

    return round2(Math.abs((last - first) / first) * 100);
  }

  private async getLimitProfiles(): Promise<Record<string, string>> {
    try {
      const rows = await prisma.bookmakerAnalytics.findMany({
        select: { bookmaker: true, limitProfile: true },
      });
      return Object.fromEntries(rows.map((r) => [r.bookmaker, r.limitProfile]));
    } catch {
      // Analytics table is optional for detection to work.
      return {};
    }
  }

  /**
   * Create the opportunity, or refresh the matching active row so a long lived
   * arb does not produce a duplicate on every scan.
   */
  private async persistOpportunity(
    gameId: string,
    candidate: DetectedOpportunity,
    risk: RiskAssessment,
    oddsDrift: number | null,
    expiresAt: Date
  ): Promise<{ record: any; isNew: boolean }> {
    const data = {
      gameId,
      expiresAt,
      arbType: candidate.arbType,
      marketType: candidate.marketType,
      profitPercentage: candidate.profitPercentage,
      stake: candidate.stake,
      expectedProfit: candidate.expectedProfit,
      legs: candidate.legs as any,
      middleProbability: candidate.middleProbability ?? null,
      middleGapLow: candidate.middleGapLow ?? null,
      middleGapHigh: candidate.middleGapHigh ?? null,
      riskLevel: risk.riskLevel,
      riskFactors: risk.factors,
      limitRisk: risk.limitRisk,
      oddsDrift,
      oddsSnapshotAge: candidate.oddsSnapshotAge,
    };

    const active = await prisma.arbitrageOpportunity.findFirst({
      where: {
        gameId,
        marketType: candidate.marketType,
        arbType: candidate.arbType,
        status: 'active',
      },
      orderBy: { detectedAt: 'desc' },
    });

    if (active && sameLegs(active.legs, candidate.legs)) {
      const record = await prisma.arbitrageOpportunity.update({
        where: { id: active.id },
        data,
      });
      return { record, isNew: false };
    }

    if (active) {
      // The prices changed, so the previous row no longer describes a
      // placeable bet.
      await prisma.arbitrageOpportunity.update({
        where: { id: active.id },
        data: { status: 'expired' },
      });
    }

    const record = await prisma.arbitrageOpportunity.create({ data });
    return { record, isNew: true };
  }
}

/** Two leg sets describe the same placeable bet. */
export function sameLegs(a: unknown, b: unknown): boolean {
  const normalize = (legs: unknown): string => {
    if (!Array.isArray(legs)) return '';
    return legs
      .map((leg: any) =>
        [leg?.side, leg?.bookmaker, leg?.odds, leg?.line ?? 'null'].join(':')
      )
      .sort()
      .join('|');
  };
  const left = normalize(a);
  return left !== '' && left === normalize(b);
}

export const arbitrageService = new ArbitrageService();
