/**
 * Arbitrage Scanner
 *
 * The write path: pull the current odds snapshot for every upcoming game,
 * run the finder over it, score the result, and persist what survives.
 * This is the only arbitrage module that talks to the database on writes.
 */

import { prisma } from '../../config/database';
import { assessRisk, notifyUsers } from './arbitrage-alert.service';
import { round2, toNumber } from './arbitrage-calculator.service';
import { detectAll, sameLegs, toOddsRow } from './arbitrage-finder.service';
import { DEFAULT_TOTAL_STAKE, OPPORTUNITY_TTL_SECONDS } from './arbitrage.config';
import { calculateImpliedProbability } from '../../utils/odds-calculator';
import type {
  ArbMarketType,
  DetectedOpportunity,
  DetectionContext,
  RiskAssessment,
  ScanResult,
} from './arbitrage.types';

export class ArbitrageScannerService {
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

      const candidates = detectAll(rows, ctx);
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
            await notifyUsers(record);
          } else {
            opportunitiesRefreshed++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(
            `Game ${game.id} (${candidate.marketType}/${candidate.arbType}): ${message}`
          );
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
