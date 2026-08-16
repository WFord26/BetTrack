/**
 * Arbitrage Finder
 *
 * Opportunity detection over a snapshot of `CurrentOdds` rows for a single
 * game. Every function here is pure: given the same rows and context it
 * returns the same opportunity, which is what makes the detection maths
 * testable without a database.
 */

import { calculateImpliedProbability } from '../../utils/odds-calculator';
import {
  buildStakePlan,
  estimateMiddleProbability,
  round2,
  sigmaFor,
  toNumber,
} from './arbitrage-calculator.service';
import {
  DEFAULT_TOTAL_STAKE,
  MIN_MIDDLE_GAP,
  MIN_MIDDLE_PROBABILITY,
  MIN_PROFIT_PERCENTAGE,
} from './arbitrage.config';
import type {
  ArbLeg,
  ArbMarketType,
  ArbSide,
  DetectedOpportunity,
  DetectionContext,
  OddsRow,
  StakePlan,
} from './arbitrage.types';

// ─── Row helpers ──────────────────────────────────────────────────────────────

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
    lastUpdated:
      row.lastUpdated instanceof Date ? row.lastUpdated : new Date(row.lastUpdated),
  };
}

export function ageSeconds(rows: Array<{ lastUpdated: Date }>, now: Date): number {
  if (rows.length === 0) return 0;
  const oldest = Math.min(...rows.map((r) => r.lastUpdated.getTime()));
  return Math.max(0, Math.round((now.getTime() - oldest) / 1000));
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

function legLabel(side: ArbSide, line: number | null, ctx: DetectionContext): string {
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

// ─── Line compatibility ───────────────────────────────────────────────────────

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
      const profitBothWin = round2(plan.payouts[0] + plan.payouts[1] - plan.totalStake);
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

/**
 * Run every detector against one game's odds snapshot.
 *
 * Returns the opportunities that cleared their thresholds, in the order the
 * detectors are declared.
 */
export function detectAll(
  rows: OddsRow[],
  ctx: DetectionContext = {}
): DetectedOpportunity[] {
  return [
    detectTwoWayArbitrage(rows, 'h2h', ctx),
    detectTwoWayArbitrage(rows, 'spreads', ctx),
    detectTwoWayArbitrage(rows, 'totals', ctx),
    detectMiddle(rows, 'spreads', ctx),
    detectMiddle(rows, 'totals', ctx),
  ].filter((c): c is DetectedOpportunity => c !== null);
}

/** Two leg sets describe the same placeable bet. */
export function sameLegs(a: unknown, b: unknown): boolean {
  const normalize = (legs: unknown): string => {
    if (!Array.isArray(legs)) return '';
    return legs
      .map((leg: any) => [leg?.side, leg?.bookmaker, leg?.odds, leg?.line ?? 'null'].join(':'))
      .sort()
      .join('|');
  };
  const left = normalize(a);
  return left !== '' && left === normalize(b);
}
