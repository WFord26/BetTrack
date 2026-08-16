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
 *
 * This file is the public entry point. The implementation lives in
 * `./arbitrage/`, split by responsibility:
 *
 *   arbitrage.types.ts               shared shapes
 *   arbitrage.config.ts              thresholds and sigma tables
 *   arbitrage-calculator.service.ts  stake maths, normal CDF, middle odds
 *   arbitrage-finder.service.ts      pure detection over an odds snapshot
 *   arbitrage-alert.service.ts       risk scoring and notification
 *   arbitrage-scanner.service.ts     scan loop and persistence (write path)
 *   arbitrage-query.service.ts       reads behind the analytics endpoints
 */

import { ArbitrageQueryService } from './arbitrage/arbitrage-query.service';
import { ArbitrageScannerService } from './arbitrage/arbitrage-scanner.service';
import { notifyUsers } from './arbitrage/arbitrage-alert.service';
import type { ArbMarketType, ArbType, ScanResult } from './arbitrage/arbitrage.types';

// ─── Public surface ───────────────────────────────────────────────────────────

export type {
  ArbLeg,
  ArbMarketType,
  ArbSide,
  ArbType,
  DetectedOpportunity,
  DetectionContext,
  OddsRow,
  RiskAssessment,
  RiskInput,
  RiskLevel,
  ScanResult,
  StakePlan,
} from './arbitrage/arbitrage.types';

export {
  buildStakePlan,
  calculateOptimalStakes,
  estimateMiddleProbability,
  normalCdf,
} from './arbitrage/arbitrage-calculator.service';

export {
  detectAll,
  detectMiddle,
  detectTwoWayArbitrage,
  lineGap,
  linesAreCompatible,
  sameLegs,
  toOddsRow,
} from './arbitrage/arbitrage-finder.service';

export { assessRisk, estimateLimitRisk } from './arbitrage/arbitrage-alert.service';

export { ArbitrageQueryService } from './arbitrage/arbitrage-query.service';
export { ArbitrageScannerService } from './arbitrage/arbitrage-scanner.service';

// ─── Facade ───────────────────────────────────────────────────────────────────

/**
 * Thin facade over the scanner and query services, kept so callers (routes,
 * jobs, the MCP mirror) depend on one arbitrage entry point rather than on the
 * internal split.
 */
export class ArbitrageService {
  private readonly scanner = new ArbitrageScannerService();
  private readonly queries = new ArbitrageQueryService();

  scanForArbitrage(): Promise<ScanResult> {
    return this.scanner.scanForArbitrage();
  }

  expireStaleOpportunities(): Promise<number> {
    return this.scanner.expireStaleOpportunities();
  }

  notifyUsers(opportunity: any): Promise<void> {
    return notifyUsers(opportunity);
  }

  getLiveOpportunities(
    options: {
      limit?: number;
      minProfit?: number;
      arbType?: ArbType;
      marketType?: ArbMarketType;
      maxSnapshotAge?: number;
    } = {}
  ) {
    return this.queries.getLiveOpportunities(options);
  }

  getHistory(
    options: { limit?: number; daysBack?: number; status?: string; userId?: string } = {}
  ) {
    return this.queries.getHistory(options);
  }

  getById(id: string) {
    return this.queries.getById(id);
  }

  markTaken(id: string, userId?: string, actualProfit?: number) {
    return this.queries.markTaken(id, userId, actualProfit);
  }

  getStats(options: { daysBack?: number; userId?: string } = {}) {
    return this.queries.getStats(options);
  }
}

export const arbitrageService = new ArbitrageService();
