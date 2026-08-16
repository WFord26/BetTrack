/**
 * Arbitrage Queries
 *
 * The read path behind `/api/analytics/arbitrage/*` and its MCP mirror:
 * live opportunities, history, single lookup, "I took this one", and the
 * rolled up detection statistics.
 */

import { prisma } from '../../config/database';
import { round2 } from './arbitrage-calculator.service';
import type { ArbMarketType, ArbType } from './arbitrage.types';

/** Game fields every arbitrage response carries alongside the opportunity. */
const gameSummaryInclude = {
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
} as const;

export class ArbitrageQueryService {
  async getLiveOpportunities(
    options: {
      limit?: number;
      minProfit?: number;
      arbType?: ArbType;
      marketType?: ArbMarketType;
      maxSnapshotAge?: number;
    } = {}
  ) {
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
      include: gameSummaryInclude,
      orderBy: [{ profitPercentage: 'desc' }, { detectedAt: 'desc' }],
      take: limit,
    });
  }

  async getHistory(
    options: {
      limit?: number;
      daysBack?: number;
      status?: string;
      userId?: string;
    } = {}
  ) {
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
      include: gameSummaryInclude,
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
}
