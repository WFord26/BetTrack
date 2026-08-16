/**
 * Arbitrage Calculator
 *
 * Pure mathematics behind an opportunity: how to split a stake so every leg
 * returns the same amount, what that split guarantees, and how often a middle
 * window actually lands. No database access, no configuration lookups beyond
 * the sigma tables — everything here is a function of its arguments.
 */

import {
  americanToDecimal,
  calculateImpliedProbability,
} from '../../utils/odds-calculator';
import {
  DEFAULT_MARGIN_SIGMA,
  DEFAULT_TOTAL_SIGMA,
  MARGIN_SIGMA,
  TOTAL_SIGMA,
} from './arbitrage.config';
import type { StakePlan } from './arbitrage.types';

// ─── Rounding ─────────────────────────────────────────────────────────────────

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Coerce a Prisma Decimal, string or number into a finite number, else null. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Distributions ────────────────────────────────────────────────────────────

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

export function sigmaFor(
  sportKey: string | undefined,
  kind: 'margin' | 'total'
): number {
  const table = kind === 'margin' ? MARGIN_SIGMA : TOTAL_SIGMA;
  const fallback = kind === 'margin' ? DEFAULT_MARGIN_SIGMA : DEFAULT_TOTAL_SIGMA;
  if (!sportKey) return fallback;
  const group = sportKey.split('_')[0];
  return table[group] ?? fallback;
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
  const totalImpliedProbability = odds.reduce(
    (sum, o) => sum + calculateImpliedProbability(o),
    0
  );

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
