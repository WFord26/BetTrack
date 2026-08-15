/**
 * Bet Leg Correlation & Parlay Analysis Service
 *
 * Detects correlation between the legs of a parlay to warn users about
 * combining outcomes that are not statistically independent, computes a
 * correlation-adjusted "true odds" figure, and surfaces hedging
 * opportunities for pre-game moneyline legs.
 *
 * Scope (v1): game-line legs only (moneyline | spread | total). Player-prop
 * correlation is blocked on the Player Props feature (FEATURE-ROADMAP #3)
 * and live/in-play hedging is blocked on a live-odds feed — both are
 * tracked as follow-ups, not implemented here. See GitHub issue #10.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { americanToDecimal, decimalToAmerican } from '../utils/odds-calculator';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SelectionType = 'moneyline' | 'spread' | 'total';
export type Selection = 'home' | 'away' | 'over' | 'under';
export type CorrelationType = 'same-game' | 'derivative' | 'inverse' | 'temporal';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Recommendation = 'approve' | 'warning' | 'reject';

/** Minimal shape a correlation check needs from a `BetLeg` (+ its `Game`). */
export interface CorrelationLeg {
  id: string;
  gameId: string;
  selectionType: string;
  selection: string;
  teamName: string | null;
  line: Prisma.Decimal | number | null;
  odds: number;
  sgpGroupId: string | null;
  game: {
    commenceTime: Date;
  };
}

export interface Correlation {
  type: CorrelationType;
  /** -1.0 (mutually exclusive) to 1.0 (perfectly correlated) */
  score: number;
  /** 0.0 to 1.0 */
  confidence: number;
  reasoning: string;
  factors: string[];
}

export interface CorrelationFlag {
  betLeg1Id: string;
  betLeg2Id: string;
  type: CorrelationType;
  score: number;
}

export interface ParlayAnalysisResult {
  betLegIds: string[];
  betId: string | null;
  nominalOdds: number;
  trueOdds: number;
  oddsDiscrepancy: number;
  riskLevel: RiskLevel;
  correlationFlags: CorrelationFlag[];
  recommendation: Recommendation;
  reasoning: string;
  suggestedFix: string | null;
}

export interface CreateBetLegInput {
  gameId: string;
  selectionType: SelectionType;
  selection: Selection;
  teamName?: string | null;
  line?: number | null;
  odds: number;
  sgpGroupId?: string | null;
}

export interface HedgeOption {
  gameId: string;
  bookmaker: string;
  selection: Selection;
  odds: number;
  hedgeStake: number;
  guaranteedProfit: number;
  guaranteedProfitPct: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/** Pairs beyond this |score| get flagged in a parlay analysis. */
const FLAG_THRESHOLD = 0.3;
const HOURS_48 = 48;
const MS_PER_HOUR = 3.6e6;

function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}

export function sortedPair(a: string, b: string): string {
  return [a, b].sort().join('+');
}

// ─── Pairwise Correlation Detection ──────────────────────────────────────────

export function detectSameGameCorrelation(a: CorrelationLeg, b: CorrelationLeg): Correlation | null {
  if (a.gameId !== b.gameId) return null;

  if (sortedPair(a.selectionType, b.selectionType) === 'spread+total') {
    return {
      type: 'same-game',
      score: 0.85,
      confidence: 0.75,
      reasoning: 'A team covering the spread implies a higher-scoring game',
      factors: ['team_performance', 'scoring_pace'],
    };
  }

  return null;
}

export function detectDerivativeCorrelation(a: CorrelationLeg, b: CorrelationLeg): Correlation | null {
  if (
    a.gameId === b.gameId &&
    sortedPair(a.selectionType, b.selectionType) === 'moneyline+spread' &&
    a.selection === b.selection
  ) {
    const spreadLeg = a.selectionType === 'spread' ? a : b;
    const spreadLine = toNumber(spreadLeg.line);

    if (spreadLine !== null && Math.abs(spreadLine) <= 3.0) {
      return {
        type: 'derivative',
        score: 0.9,
        confidence: 0.85,
        reasoning: 'A small spread means the moneyline and spread are highly correlated',
        factors: ['point_differential', 'win_probability'],
      };
    }
  }

  return null;
}

export function detectInverseCorrelation(a: CorrelationLeg, b: CorrelationLeg): Correlation | null {
  if (
    a.gameId === b.gameId &&
    a.selectionType === 'moneyline' &&
    b.selectionType === 'moneyline' &&
    a.selection !== b.selection
  ) {
    return {
      type: 'inverse',
      score: -1.0,
      confidence: 1.0,
      reasoning: 'Mutually exclusive outcomes — cannot both win',
      factors: ['game_result'],
    };
  }

  return null;
}

export function detectTemporalCorrelation(a: CorrelationLeg, b: CorrelationLeg): Correlation | null {
  if (a.teamName && a.teamName === b.teamName && a.gameId !== b.gameId) {
    const hours = Math.abs(+a.game.commenceTime - +b.game.commenceTime) / MS_PER_HOUR;

    if (hours <= HOURS_48) {
      return {
        type: 'temporal',
        score: 0.4,
        confidence: 0.5,
        reasoning: 'Back-to-back games affect rest and performance',
        factors: ['fatigue', 'schedule', 'travel'],
      };
    }
  }

  return null;
}

const DETECTORS = [
  detectInverseCorrelation,
  detectDerivativeCorrelation,
  detectSameGameCorrelation,
  detectTemporalCorrelation,
];

// ─── True Odds ────────────────────────────────────────────────────────────────

export function correlationPenalty(score: number): number {
  if (score > 0) return 1.0 - score * 0.3; // positive correlation lowers true odds (up to 30%)
  if (score < 0) return 1.0 + Math.abs(score) * 0.2; // negative correlation raises them (up to 20%)
  return 1.0;
}

export function riskLevelForFlags(flags: CorrelationFlag[]): RiskLevel {
  if (flags.some((f) => f.type === 'inverse')) return 'high';
  const maxAbsScore = flags.reduce((max, f) => Math.max(max, Math.abs(f.score)), 0);
  if (maxAbsScore > 0.6) return 'high';
  if (maxAbsScore > FLAG_THRESHOLD) return 'medium';
  return 'low';
}

export function recommendationForRisk(riskLevel: RiskLevel, hasInverse: boolean): Recommendation {
  if (hasInverse) return 'reject';
  if (riskLevel === 'high') return 'warning';
  if (riskLevel === 'medium') return 'warning';
  return 'approve';
}

// ─── Service ──────────────────────────────────────────────────────────────────

class CorrelationService {
  /**
   * Pairwise correlation between two legs. `null` when no known correlation
   * pattern applies (i.e. the legs are treated as independent).
   */
  analyzeCorrelation(legA: CorrelationLeg, legB: CorrelationLeg): Correlation | null {
    for (const detect of DETECTORS) {
      const correlation = detect(legA, legB);
      if (correlation) return correlation;
    }
    return null;
  }

  /**
   * Correlation-adjusted combined American odds for a set of legs.
   * Mirrors `calculateParlayOdds` but applies a penalty for every
   * correlated pair on top of the naive product-of-decimal-odds figure.
   */
  calculateTrueOdds(legs: CorrelationLeg[]): number {
    if (legs.length === 0) {
      throw new Error('Parlay must have at least one leg');
    }

    let trueDecimal = legs.reduce((acc, leg) => acc * americanToDecimal(leg.odds), 1.0);

    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 1; j < legs.length; j++) {
        const correlation = this.analyzeCorrelation(legs[i], legs[j]);
        if (correlation) {
          trueDecimal *= correlationPenalty(correlation.score);
        }
      }
    }

    return decimalToAmerican(trueDecimal);
  }

  /**
   * Analyze every pair of legs in a parlay, flag pairs beyond the
   * threshold, and produce a risk-scored recommendation.
   *
   * Legs sharing an `sgpGroupId` are a known/expected same-game-parlay
   * grouping — those pairs are still scored (the true-odds math needs
   * them) but are reported as priced/expected rather than a mistake.
   */
  private buildAnalysis(
    legs: CorrelationLeg[],
    betLegIds: string[],
    betId: string | null
  ): ParlayAnalysisResult {
    const nominalOdds = decimalToAmerican(
      legs.reduce((acc, leg) => acc * americanToDecimal(leg.odds), 1.0)
    );
    const trueOdds = this.calculateTrueOdds(legs);

    const nominalDecimal = americanToDecimal(nominalOdds);
    const trueDecimal = americanToDecimal(trueOdds);
    const oddsDiscrepancy = Number(
      (((nominalDecimal - trueDecimal) / nominalDecimal) * 100).toFixed(2)
    );

    const flags: CorrelationFlag[] = [];
    const expectedPairs: CorrelationFlag[] = [];

    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 1; j < legs.length; j++) {
        const legA = legs[i];
        const legB = legs[j];
        const correlation = this.analyzeCorrelation(legA, legB);
        if (!correlation) continue;
        if (Math.abs(correlation.score) <= FLAG_THRESHOLD) continue;

        const flag: CorrelationFlag = {
          betLeg1Id: legA.id,
          betLeg2Id: legB.id,
          type: correlation.type,
          score: correlation.score,
        };

        const isKnownSgp =
          legA.sgpGroupId !== null &&
          legA.sgpGroupId !== undefined &&
          legA.sgpGroupId === legB.sgpGroupId;

        if (isKnownSgp && correlation.type !== 'inverse') {
          expectedPairs.push(flag);
        } else {
          flags.push(flag);
        }
      }
    }

    const hasInverse = flags.some((f) => f.type === 'inverse');
    const riskLevel = riskLevelForFlags(flags);
    const recommendation = recommendationForRisk(riskLevel, hasInverse);

    const reasoning = this.buildReasoning(flags, expectedPairs, oddsDiscrepancy, recommendation);
    const suggestedFix = this.buildSuggestedFix(flags, legs);

    return {
      betLegIds,
      betId,
      nominalOdds,
      trueOdds,
      oddsDiscrepancy,
      riskLevel,
      correlationFlags: flags,
      recommendation,
      reasoning,
      suggestedFix,
    };
  }

  private buildReasoning(
    flags: CorrelationFlag[],
    expectedPairs: CorrelationFlag[],
    oddsDiscrepancy: number,
    recommendation: Recommendation
  ): string {
    const parts: string[] = [];

    if (flags.some((f) => f.type === 'inverse')) {
      parts.push('This parlay contains mutually exclusive outcomes that cannot both win.');
    } else if (flags.length > 0) {
      const types = [...new Set(flags.map((f) => f.type))].join(', ');
      parts.push(
        `Found ${flags.length} correlated leg pair${flags.length === 1 ? '' : 's'} (${types}). ` +
          `True odds are ${Math.abs(oddsDiscrepancy)}% ${oddsDiscrepancy >= 0 ? 'worse' : 'better'} than the advertised price implies.`
      );
    } else {
      parts.push('No significant correlation detected between legs — they behave independently.');
    }

    if (expectedPairs.length > 0) {
      parts.push(
        `${expectedPairs.length} pair${expectedPairs.length === 1 ? ' is' : 's are'} part of an existing same-game-parlay grouping and priced accordingly.`
      );
    }

    if (recommendation === 'reject') {
      parts.push('Recommendation: do not place this parlay as constructed.');
    } else if (recommendation === 'warning') {
      parts.push('Recommendation: proceed with caution — the true payout is lower than advertised.');
    }

    return parts.join(' ');
  }

  private buildSuggestedFix(flags: CorrelationFlag[], legs: CorrelationLeg[]): string | null {
    const inverseFlag = flags.find((f) => f.type === 'inverse');
    if (inverseFlag) {
      return 'Remove one of the two mutually-exclusive moneyline legs before placing this bet.';
    }

    if (flags.length > 0) {
      const highest = flags.reduce((max, f) => (Math.abs(f.score) > Math.abs(max.score) ? f : max));
      const legA = legs.find((l) => l.id === highest.betLeg1Id);
      const legB = legs.find((l) => l.id === highest.betLeg2Id);
      if (legA && legB) {
        return (
          `Consider dropping one leg from the ${legA.teamName ?? 'first'} game to reduce correlation ` +
          `(${legA.selectionType} + ${legB.selectionType} pair scored ${highest.score.toFixed(2)}).`
        );
      }
    }

    return null;
  }

  private async fetchLegsWithGame(betLegIds: string[]): Promise<CorrelationLeg[]> {
    const legs = await prisma.betLeg.findMany({
      where: { id: { in: betLegIds } },
      include: { game: { select: { commenceTime: true } } },
    });

    // Preserve caller-supplied ordering for deterministic output.
    const byId = new Map(legs.map((leg) => [leg.id, leg]));
    return betLegIds
      .map((id) => byId.get(id))
      .filter((leg): leg is NonNullable<typeof leg> => Boolean(leg));
  }

  /**
   * Fetch two persisted `BetLeg` rows and analyze correlation between them.
   *
   * When `userId` is provided (OAuth mode), both legs' parent bets must
   * belong to that user — otherwise a signed-in user who obtains another
   * user's bet-leg IDs could learn whether those private legs are
   * same-game/inverse/temporal etc. Missing and unauthorized legs are
   * reported identically ("not found") so existence isn't leaked either.
   */
  async analyzeLegPair(
    betLeg1Id: string,
    betLeg2Id: string,
    userId?: string
  ): Promise<Correlation | null> {
    if (userId) {
      await this.assertLegsOwnedBy([betLeg1Id, betLeg2Id], userId);
    }

    const [legA, legB] = await this.fetchLegsWithGame([betLeg1Id, betLeg2Id]);
    if (!legA || !legB) {
      throw new Error('One or both bet legs not found');
    }
    return this.analyzeCorrelation(legA, legB);
  }

  /** Throws a "not found" error unless every leg's parent bet belongs to `userId`. */
  private async assertLegsOwnedBy(betLegIds: string[], userId: string): Promise<void> {
    const legs = await prisma.betLeg.findMany({
      where: { id: { in: betLegIds } },
      select: { id: true, bet: { select: { userId: true } } },
    });

    const ownedIds = new Set(
      legs.filter((leg) => leg.bet.userId === userId).map((leg) => leg.id)
    );

    if (!betLegIds.every((id) => ownedIds.has(id))) {
      throw new Error('One or both bet legs not found');
    }
  }

  /** Analyze a placed `Bet` — loads its legs (with game) and persists a `ParlayAnalysis`. */
  async analyzeParlay(betId: string, userId?: string): Promise<ParlayAnalysisResult> {
    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: { legs: { include: { game: { select: { commenceTime: true } } } } },
    });

    if (!bet) {
      throw new Error(`Bet ${betId} not found`);
    }

    if (bet.legs.length < 2) {
      throw new Error('Parlay analysis requires at least 2 legs');
    }

    const result = this.buildAnalysis(
      bet.legs,
      bet.legs.map((leg) => leg.id),
      bet.id
    );

    await this.persistAnalysis(result, userId ?? bet.userId ?? undefined);
    return result;
  }

  /**
   * Analyze a draft slip — legs that have not been saved as `BetLeg` rows
   * yet. Runs the same detection logic against synthetic leg objects and
   * does not persist a `ParlayAnalysis` (there is no `betLegIds` to
   * reference until the legs exist).
   */
  async analyzeDraftSlip(legs: CreateBetLegInput[], gameCommenceTimes: Map<string, Date>): Promise<ParlayAnalysisResult> {
    if (legs.length < 2) {
      throw new Error('Parlay analysis requires at least 2 legs');
    }

    const syntheticLegs: CorrelationLeg[] = legs.map((leg, index) => ({
      id: `draft-${index}`,
      gameId: leg.gameId,
      selectionType: leg.selectionType,
      selection: leg.selection,
      teamName: leg.teamName ?? null,
      line: leg.line ?? null,
      odds: leg.odds,
      sgpGroupId: leg.sgpGroupId ?? null,
      game: { commenceTime: gameCommenceTimes.get(leg.gameId) ?? new Date() },
    }));

    return this.buildAnalysis(
      syntheticLegs,
      syntheticLegs.map((leg) => leg.id),
      null
    );
  }

  private async persistAnalysis(result: ParlayAnalysisResult, userId?: string): Promise<void> {
    if (!userId) {
      // Standalone mode (no auth) has no user to attach history to.
      return;
    }

    try {
      await prisma.parlayAnalysis.create({
        data: {
          userId,
          betLegIds: result.betLegIds,
          betId: result.betId,
          nominalOdds: result.nominalOdds,
          trueOdds: result.trueOdds,
          oddsDiscrepancy: result.oddsDiscrepancy,
          riskLevel: result.riskLevel,
          correlationFlags: result.correlationFlags as unknown as Prisma.InputJsonValue,
          recommendation: result.recommendation,
          reasoning: result.reasoning,
          suggestedFix: result.suggestedFix,
          placed: result.betId !== null,
        },
      });
    } catch (error) {
      // History is best-effort — a failed write shouldn't fail the analysis.
      logger.error('Failed to persist parlay analysis:', error);
    }
  }

  async getHistory(params: { userId?: string; limit?: number; riskLevel?: RiskLevel }) {
    const { userId, limit = 25, riskLevel } = params;

    return prisma.parlayAnalysis.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(riskLevel ? { riskLevel } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Pre-game hedging opportunities for a moneyline leg: the opposite side
   * of the same game across every bookmaker with fresh odds.
   *
   * When `userId` is provided (OAuth mode), the leg's parent bet must
   * belong to that user — otherwise a signed-in user who obtains another
   * user's moneyline leg ID could fetch hedge options and infer the
   * private original side from the returned opposite selection. Missing
   * and unauthorized legs are reported identically ("not found").
   *
   * Scope: pre-game only — `CurrentOdds` has no in-play feed today, so
   * live hedging (e.g. mid-game cash-out math) is out of scope for v1.
   */
  async findHedgingOpportunities(betLegId: string, userId?: string): Promise<HedgeOption[]> {
    const leg = await prisma.betLeg.findUnique({
      where: { id: betLegId },
      include: { bet: { select: { userId: true } } },
    });
    if (!leg || (userId && leg.bet.userId !== userId)) {
      throw new Error(`Bet leg ${betLegId} not found`);
    }

    if (leg.selectionType !== 'moneyline') {
      return [];
    }

    const oppositeSelection: Selection = leg.selection === 'home' ? 'away' : 'home';

    const oddsRows = await prisma.currentOdds.findMany({
      where: { gameId: leg.gameId, marketType: 'h2h' },
    });

    const originalStake = 100; // Normalized reference stake; caller scales as needed.
    const originalOdds = leg.odds;
    const originalPayout = originalStake * americanToDecimal(originalOdds);

    const options: HedgeOption[] = [];

    for (const row of oddsRows) {
      const hedgePrice = oppositeSelection === 'home' ? row.homePrice : row.awayPrice;
      if (hedgePrice === null) continue;

      // Guaranteed-equal-profit hedge stake: stake_hedge * decimal_hedge = originalPayout
      const hedgeDecimal = americanToDecimal(hedgePrice);
      const hedgeStake = originalPayout / hedgeDecimal;
      const guaranteedProfit = originalPayout - originalStake - hedgeStake;
      const guaranteedProfitPct = (guaranteedProfit / (originalStake + hedgeStake)) * 100;

      options.push({
        gameId: leg.gameId,
        bookmaker: row.bookmaker,
        selection: oppositeSelection,
        odds: hedgePrice,
        hedgeStake: Number(hedgeStake.toFixed(2)),
        guaranteedProfit: Number(guaranteedProfit.toFixed(2)),
        guaranteedProfitPct: Number(guaranteedProfitPct.toFixed(2)),
      });
    }

    return options.sort((a, b) => b.guaranteedProfit - a.guaranteedProfit);
  }
}

export const correlationService = new CorrelationService();
