/**
 * Bet Analytics
 *
 * P&L and performance reporting over the bet table. Everything here aggregates
 * in the database — groupBy for the status and bet-type breakdowns, one raw
 * query for the per-sport split — rather than loading rows into memory.
 */

import { prisma } from '../../config/database';
import { BetStats, StatsFilters } from '../../types/bet.types';
import { Prisma } from '@prisma/client';

export class BetAnalyticsService {
  /**
   * Get betting statistics using database aggregation
   * Uses groupBy/aggregate instead of loading all rows into memory
   */
  async getStats(filters: StatsFilters = {}): Promise<BetStats> {
    // Build where clause
    const where: Prisma.BetWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.betType) {
      where.betType = filters.betType;
    }

    if (filters.startDate || filters.endDate) {
      where.placedAt = {};
      if (filters.startDate) {
        where.placedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.placedAt.lte = filters.endDate;
      }
    }

    if (filters.sportKey) {
      where.legs = {
        some: {
          game: {
            sport: {
              key: filters.sportKey
            }
          }
        }
      };
    }

    // Run all aggregation queries in parallel
    const [statusGroups, betTypeStatusGroups, sportBreakdown] = await Promise.all([
      // 1. Group by status: counts + sums
      prisma.bet.groupBy({
        by: ['status'],
        where,
        _count: true,
        _sum: {
          stake: true,
          actualPayout: true
        }
      }),

      // 2. Group by betType + status: counts + sums for byBetType breakdown
      prisma.bet.groupBy({
        by: ['betType', 'status'],
        where,
        _count: true,
        _sum: {
          stake: true,
          actualPayout: true
        }
      }),

      // 3. By sport breakdown using raw SQL (joins through bet_legs → games → sports)
      this.getStatsBySport(where, filters)
    ]);

    // Build stats from status groups
    const stats: BetStats = {
      totalBets: 0,
      wonBets: 0,
      lostBets: 0,
      pushBets: 0,
      pendingBets: 0,
      winRate: 0,
      totalStaked: 0,
      totalPayout: 0,
      netProfit: 0,
      roi: 0,
      byBetType: {},
      bySport: {}
    };

    for (const group of statusGroups) {
      const count = group._count;
      const stake = group._sum.stake?.toNumber() || 0;
      const payout = group._sum.actualPayout?.toNumber() || 0;

      stats.totalBets += count;
      stats.totalStaked += stake;
      stats.totalPayout += payout;

      switch (group.status) {
        case 'won': stats.wonBets = count; break;
        case 'lost': stats.lostBets = count; break;
        case 'push': stats.pushBets = count; break;
        case 'pending': stats.pendingBets = count; break;
      }
    }

    // Build byBetType from betType+status groups
    for (const group of betTypeStatusGroups) {
      const betType = group.betType;
      const stake = group._sum.stake?.toNumber() || 0;
      const payout = group._sum.actualPayout?.toNumber() || 0;

      if (!stats.byBetType[betType]) {
        stats.byBetType[betType] = { count: 0, won: 0, netProfit: 0 };
      }
      stats.byBetType[betType]!.count += group._count;
      if (group.status === 'won') stats.byBetType[betType]!.won += group._count;
      stats.byBetType[betType]!.netProfit += (payout - stake);
    }

    // Apply sport breakdown
    stats.bySport = sportBreakdown;

    // Calculate rates
    stats.netProfit = stats.totalPayout - stats.totalStaked;

    const settledBets = stats.wonBets + stats.lostBets + stats.pushBets;
    if (settledBets > 0) {
      stats.winRate = (stats.wonBets / settledBets) * 100;
    }

    if (stats.totalStaked > 0) {
      stats.roi = (stats.netProfit / stats.totalStaked) * 100;
    }

    return stats;
  }

  /**
   * Get stats broken down by sport using a raw SQL query.
   * Joins bet_legs → games → sports to attribute each bet to its first leg's sport.
   */
  private async getStatsBySport(
    _where: Prisma.BetWhereInput,
    filters: StatsFilters
  ): Promise<BetStats['bySport']> {
    // Build parameterized WHERE conditions for the raw query
    const conditions: string[] = ['1=1'];
    const params: (string | Date)[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`b.user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }
    if (filters.betType) {
      conditions.push(`b.bet_type = $${paramIndex++}`);
      params.push(filters.betType);
    }
    if (filters.startDate) {
      conditions.push(`b.placed_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`b.placed_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }
    if (filters.sportKey) {
      conditions.push(`s.key = $${paramIndex++}`);
      params.push(filters.sportKey);
    }

    const whereClause = conditions.join(' AND ');

    // Use DISTINCT ON to pick first leg per bet, then aggregate by sport
    const rows = await prisma.$queryRawUnsafe<Array<{
      sport_key: string;
      count: bigint;
      won: bigint;
      net_profit: number;
    }>>(
      `SELECT
        s.key AS sport_key,
        COUNT(*)::bigint AS count,
        COUNT(*) FILTER (WHERE b.status = 'won')::bigint AS won,
        COALESCE(SUM(COALESCE(b.actual_payout, 0) - b.stake), 0)::float AS net_profit
      FROM (
        SELECT DISTINCT ON (bl.bet_id) bl.bet_id, g.sport_id
        FROM bet_legs bl
        JOIN games g ON g.id = bl.game_id
        ORDER BY bl.bet_id, bl.created_at
      ) first_leg
      JOIN bets b ON b.id = first_leg.bet_id
      JOIN sports s ON s.id = first_leg.sport_id
      WHERE ${whereClause}
      GROUP BY s.key`,
      ...params
    );

    const bySport: BetStats['bySport'] = {};
    for (const row of rows) {
      bySport[row.sport_key] = {
        count: Number(row.count),
        won: Number(row.won),
        netProfit: row.net_profit
      };
    }
    return bySport;
  }
}

export const betAnalyticsService = new BetAnalyticsService();
