/**
 * Tuning constants for arbitrage detection, risk scoring and persistence.
 *
 * Everything the operator can change lives here so a threshold is adjusted in
 * one place rather than hunted through the detection code.
 */

import { env } from '../../config/env';

// ─── Detection thresholds ─────────────────────────────────────────────────────

export const MIN_PROFIT_PERCENTAGE = parseFloat(env.ARBITRAGE_MIN_PROFIT_PCT) || 0.5;
export const DEFAULT_TOTAL_STAKE = parseFloat(env.ARBITRAGE_DEFAULT_STAKE) || 1000;
export const OPPORTUNITY_TTL_SECONDS = parseInt(env.ARBITRAGE_TTL_SECONDS, 10) || 600;
export const MIN_MIDDLE_PROBABILITY =
  parseFloat(env.ARBITRAGE_MIN_MIDDLE_PROBABILITY) || 0.10;

/** Minimum gap, in points, before a spread/total pair counts as a middle. */
export const MIN_MIDDLE_GAP = 2.0;

// ─── Risk thresholds ──────────────────────────────────────────────────────────

/** Profit above this is treated as a data error rather than free money. */
export const SUSPICIOUS_PROFIT_PCT = 10.0;

/** Snapshot older than this (seconds) downgrades confidence. */
export const STALE_SNAPSHOT_SECONDS = 300;

/** Odds drift above this percentage marks the market as fast moving. */
export const FAST_MOVING_DRIFT_PCT = 5.0;

/** Bookmaker limit profiles that make an account restriction likely. */
export const RESTRICTIVE_LIMIT_PROFILES = ['low', 'tight', 'restrictive'];

// ─── Outcome distributions ────────────────────────────────────────────────────

/**
 * Standard deviation of the final margin (spreads) and of the final combined
 * score (totals), by sport group. Used to estimate how often a middle lands.
 * These are rough historical values and only drive a probability estimate.
 */
export const MARGIN_SIGMA: Record<string, number> = {
  americanfootball: 13.5,
  basketball: 11.5,
  baseball: 4.4,
  icehockey: 2.2,
  soccer: 1.7,
};

export const TOTAL_SIGMA: Record<string, number> = {
  americanfootball: 10.5,
  basketball: 12.0,
  baseball: 3.2,
  icehockey: 1.9,
  soccer: 1.3,
};

export const DEFAULT_MARGIN_SIGMA = 10.0;
export const DEFAULT_TOTAL_SIGMA = 9.0;
