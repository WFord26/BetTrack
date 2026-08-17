/**
 * Arbitrage Alerts
 *
 * Threshold management and notification. Decides how much to trust an
 * opportunity (staleness, drift, suspicious edge, time to start, account limit
 * exposure) and delivers the alert once one is created.
 */

import { logger } from '../../config/logger';
import {
  FAST_MOVING_DRIFT_PCT,
  RESTRICTIVE_LIMIT_PROFILES,
  STALE_SNAPSHOT_SECONDS,
  SUSPICIOUS_PROFIT_PCT,
} from './arbitrage.config';
import type { RiskAssessment, RiskInput, RiskLevel } from './arbitrage.types';

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

/**
 * v1 notification delivery is in-app only: the row itself is the alert and
 * the dashboard/notifications page polls `/api/analytics/arbitrage/live`.
 * Push, email, SMS and webhook delivery are a separate prerequisite issue.
 */
export async function notifyUsers(opportunity: any): Promise<void> {
  logger.info(
    `💰 Arbitrage ${opportunity.arbType} on ${opportunity.marketType}: ` +
      `${Number(opportunity.profitPercentage).toFixed(2)}% ` +
      `(risk ${opportunity.riskLevel}, snapshot ${opportunity.oddsSnapshotAge}s old)`
  );
}
