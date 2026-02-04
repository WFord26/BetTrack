import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

/**
 * CLV (Closing Line Value) Service
 * 
 * Tracks and calculates Closing Line Value - the #1 indicator of long-term betting profitability.
 * CLV measures the difference between odds at bet placement vs odds at game start.
 */
export class CLVService {
  
  /**
   * Capture closing lines for games starting soon
   * Should be called 5 minutes before game start via cron job
   */
  async captureClosingLine(gameId: string): Promise<void> {
    try {
      // Get all pending bet legs for this game
      const betLegs = await prisma.betLeg.findMany({
        where: {
          gameId,
          status: 'pending',
          closingOdds: null // Only update if not already captured
        }
      });

      if (betLegs.length === 0) {
        logger.debug(`No pending bet legs found for game ${gameId}`);
        return;
      }

      // Get current odds from odds snapshots (latest snapshot per bookmaker/market)
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { oddsSnapshots: true }
      });

      if (!game || !game.oddsSnapshots || game.oddsSnapshots.length === 0) {
        logger.warn(`No odds snapshots found for game ${gameId}`);
        return;
      }

      // Update closing odds for each bet leg
      for (const leg of betLegs) {
        // Find matching odds snapshot for this selection
        const matchingSnapshot = this.findMatchingOddsSnapshot(
          game.oddsSnapshots,
          leg.selectionType,
          leg.selection,
          leg.line
        );

        if (matchingSnapshot) {
          await prisma.betLeg.update({
            where: { id: leg.id },
            data: {
              closingOdds: Math.round(matchingSnapshot.price)
            }
          });

          logger.info(`Captured closing odds for bet leg ${leg.id}: ${matchingSnapshot.price}`);
        } else {
          logger.warn(`No matching odds snapshot for bet leg ${leg.id}`);
        }
      }

      logger.info(`Captured closing lines for ${betLegs.length} bet legs on game ${gameId}`);
    } catch (error) {
      logger.error(`Error capturing closing line for game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate CLV for a specific bet leg
   * Returns CLV percentage (positive = beat closing line, negative = worse than closing line)
   */
  async calculateCLV(betLegId: string): Promise<number | null> {
    try {
      const betLeg = await prisma.betLeg.findUnique({
        where: { id: betLegId }
      });

      if (!betLeg || !betLeg.closingOdds) {
        logger.warn(`Cannot calculate CLV for bet leg ${betLegId}: missing closing odds`);
        return null;
      }

      const openingOdds = betLeg.odds;
      const closingOdds = betLeg.closingOdds;

      // Calculate implied probabilities
      const openingImplied = this.americanOddsToImpliedProbability(openingOdds);
      const closingImplied = this.americanOddsToImpliedProbability(closingOdds);

      // CLV formula: ((Closing Implied - Opening Implied) / Opening Implied) * 100
      const clv = ((closingImplied - openingImplied) / openingImplied) * 100;

      // Determine CLV category
      let clvCategory: string;
      if (clv > 1) {
        clvCategory = 'positive';
      } else if (clv < -1) {
        clvCategory = 'negative';
      } else {
        clvCategory = 'neutral';
      }

      // Update bet leg with CLV data
      await prisma.betLeg.update({
        where: { id: betLegId },
        data: {
          clv: new Prisma.Decimal(clv.toFixed(2)),
          clvCategory
        }
      });

      logger.info(`Calculated CLV for bet leg ${betLegId}: ${clv.toFixed(2)}%`);
      return clv;
    } catch (error) {
      logger.error(`Error calculating CLV for bet leg ${betLegId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate CLV for all bet legs in a bet
   */
  async calculateCLVForBet(betId: string): Promise<void> {
    try {
      const bet = await prisma.bet.findUnique({
        where: { id: betId },
        include: { legs: true }
      });

      if (!bet) {
        logger.warn(`Bet ${betId} not found`);
        return;
      }

      for (const leg of bet.legs) {
        if (leg.closingOdds && !leg.clv) {
          await this.calculateCLV(leg.id);
        }
      }

      logger.info(`Calculated CLV for all legs in bet ${betId}`);
    } catch (error) {
      logger.error(`Error calculating CLV for bet ${betId}:`, error);
      throw error;
    }
  }

  /**
   * Generate CLV report for a user
   */
  async generateCLVReport(
    userId: string,
    filters?: {
      sportKey?: string;
      betType?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    summary: {
      totalBets: number;
      averageCLV: number;
      positiveCLVCount: number;
      negativeCLVCount: number;
      neutralCLVCount: number;
      clvWinRate: number;
    };
    bySport: Array<{
      sportKey: string;
      averageCLV: number;
      count: number;
    }>;
    byBookmaker: Array<{
      bookmaker: string;
      averageCLV: number;
      count: number;
    }>;
    topBets: Array<{
      betId: string;
      betName: string;
      clv: number;
      createdAt: Date;
    }>;
    worstBets: Array<{
      betId: string;
      betName: string;
      clv: number;
      createdAt: Date;
    }>;
  }> {
    try {
      // Build where clause
      const where: any = {
        bet: {
          userId,
          ...(filters?.betType && { betType: filters.betType }),
          ...(filters?.startDate && { createdAt: { gte: filters.startDate } }),
          ...(filters?.endDate && { createdAt: { lte: filters.endDate } })
        },
        clv: { not: null }
      };

      if (filters?.sportKey) {
        where.game = { sportKey: filters.sportKey };
      }

      // Get all bet legs with CLV data
      const betLegs = await prisma.betLeg.findMany({
        where,
        include: {
          bet: true,
          game: {
            include: { sport: true }
          }
        }
      });

      if (betLegs.length === 0) {
        return {
          summary: {
            totalBets: 0,
            averageCLV: 0,
            positiveCLVCount: 0,
            negativeCLVCount: 0,
            neutralCLVCount: 0,
            clvWinRate: 0
          },
          bySport: [],
          byBookmaker: [],
          topBets: [],
          worstBets: []
        };
      }

      // Calculate summary statistics
      const totalBets = betLegs.length;
      const avgCLV = betLegs.reduce((sum, leg) => sum + (leg.clv?.toNumber() || 0), 0) / totalBets;
      const positiveCLVCount = betLegs.filter(leg => leg.clvCategory === 'positive').length;
      const negativeCLVCount = betLegs.filter(leg => leg.clvCategory === 'negative').length;
      const neutralCLVCount = betLegs.filter(leg => leg.clvCategory === 'neutral').length;

      // Calculate CLV win rate (percentage of settled bets with positive CLV that won)
      const settledBets = betLegs.filter(leg => leg.status !== 'pending');
      const positiveCLVWins = settledBets.filter(
        leg => leg.clvCategory === 'positive' && leg.status === 'won'
      ).length;
      const positiveCLVTotal = settledBets.filter(leg => leg.clvCategory === 'positive').length;
      const clvWinRate = positiveCLVTotal > 0 ? (positiveCLVWins / positiveCLVTotal) * 100 : 0;

      // Group by sport
      const bySport = this.groupByField(betLegs, 'game.sport.key');

      // Group by bookmaker (extract from bet name or use default)
      const byBookmaker = this.groupByBookmaker(betLegs);

      // Get top 5 and worst 5 bets by CLV
      const sortedByPositiveCLV = [...betLegs].sort((a, b) => 
        (b.clv?.toNumber() || 0) - (a.clv?.toNumber() || 0)
      );
      const sortedByNegativeCLV = [...betLegs].sort((a, b) => 
        (a.clv?.toNumber() || 0) - (b.clv?.toNumber() || 0)
      );

      const topBets = sortedByPositiveCLV.slice(0, 5).map(leg => ({
        betId: leg.bet.id,
        betName: leg.bet.name,
        clv: leg.clv?.toNumber() || 0,
        createdAt: leg.bet.createdAt
      }));

      const worstBets = sortedByNegativeCLV.slice(0, 5).map(leg => ({
        betId: leg.bet.id,
        betName: leg.bet.name,
        clv: leg.clv?.toNumber() || 0,
        createdAt: leg.bet.createdAt
      }));

      return {
        summary: {
          totalBets,
          averageCLV: avgCLV,
          positiveCLVCount,
          negativeCLVCount,
          neutralCLVCount,
          clvWinRate
        },
        bySport,
        byBookmaker,
        topBets,
        worstBets
      };
    } catch (error) {
      logger.error(`Error generating CLV report for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update aggregated CLV stats for a user
   * Should be called after bets are settled
   */
  async updateCLVStats(userId: string): Promise<void> {
    try {
      // Get all bet legs with CLV data
      const betLegs = await prisma.betLeg.findMany({
        where: {
          bet: { userId },
          clv: { not: null }
        },
        include: {
          bet: true,
          game: { include: { sport: true } }
        }
      });

      if (betLegs.length === 0) {
        logger.info(`No CLV data found for user ${userId}`);
        return;
      }

      // Group by sport and bet type, calculate stats for different periods
      const periods = ['week', 'month', 'season', 'all-time'];
      const sportKeys = [...new Set(betLegs.map(leg => leg.game.sport.key))];
      const betTypes = [...new Set(betLegs.map(leg => leg.bet.betType))];

      for (const sportKey of sportKeys) {
        for (const betType of betTypes) {
          for (const period of periods) {
            const filteredLegs = this.filterByPeriod(
              betLegs.filter(leg => 
                leg.game.sport.key === sportKey && leg.bet.betType === betType
              ),
              period
            );

            if (filteredLegs.length === 0) continue;

            const stats = this.calculateStats(filteredLegs);

            await prisma.userCLVStats.upsert({
              where: {
                userId_sportKey_betType_period: {
                  userId,
                  sportKey,
                  betType,
                  period
                }
              },
              create: {
                userId,
                sportKey,
                betType,
                period,
                ...stats
              },
              update: {
                ...stats,
                calculatedAt: new Date()
              }
            });
          }
        }
      }

      logger.info(`Updated CLV stats for user ${userId}`);
    } catch (error) {
      logger.error(`Error updating CLV stats for user ${userId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Convert American odds to implied probability
   */
  private americanOddsToImpliedProbability(odds: number): number {
    if (odds > 0) {
      // Positive odds: 100 / (odds + 100)
      return 100 / (odds + 100);
    } else {
      // Negative odds: |odds| / (|odds| + 100)
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }

  /**
   * Find matching odds snapshot for a bet leg
   */
  private findMatchingOddsSnapshot(
    snapshots: any[],
    selectionType: string,
    selection: string,
    line: Prisma.Decimal | null
  ): any | null {
    // Get the most recent snapshot for the matching market and selection
    const matchingSnapshots = snapshots.filter(snapshot => {
      // Match by market type
      const marketTypeMatch = 
        (selectionType === 'moneyline' && snapshot.marketType === 'h2h') ||
        (selectionType === 'spread' && snapshot.marketType === 'spreads') ||
        (selectionType === 'total' && snapshot.marketType === 'totals');

      if (!marketTypeMatch) return false;

      // Match by selection
      const selectionMatch = snapshot.outcome === selection;

      // Match by line (for spreads/totals)
      if (line && snapshot.point !== null) {
        return selectionMatch && Math.abs(snapshot.point - line.toNumber()) < 0.1;
      }

      return selectionMatch;
    });

    // Return the most recent matching snapshot
    return matchingSnapshots.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0] || null;
  }

  /**
   * Group bet legs by a field and calculate average CLV
   */
  private groupByField(betLegs: any[], field: string): Array<{ sportKey: string; averageCLV: number; count: number }> {
    const groups = new Map<string, number[]>();

    for (const leg of betLegs) {
      const value = this.getNestedProperty(leg, field) || 'unknown';
      if (!groups.has(value)) {
        groups.set(value, []);
      }
      groups.get(value)!.push(leg.clv?.toNumber() || 0);
    }

    return Array.from(groups.entries()).map(([sportKey, clvValues]) => ({
      sportKey,
      averageCLV: clvValues.reduce((sum, val) => sum + val, 0) / clvValues.length,
      count: clvValues.length
    }));
  }

  /**
   * Group bet legs by bookmaker
   */
  private groupByBookmaker(betLegs: any[]): Array<{ bookmaker: string; averageCLV: number; count: number }> {
    // Extract bookmaker from bet name or use 'unknown'
    const groups = new Map<string, number[]>();

    for (const leg of betLegs) {
      const bookmaker = this.extractBookmakerFromBetName(leg.bet.name);
      if (!groups.has(bookmaker)) {
        groups.set(bookmaker, []);
      }
      groups.get(bookmaker)!.push(leg.clv?.toNumber() || 0);
    }

    return Array.from(groups.entries()).map(([bookmaker, clvValues]) => ({
      bookmaker,
      averageCLV: clvValues.reduce((sum, val) => sum + val, 0) / clvValues.length,
      count: clvValues.length
    }));
  }

  /**
   * Extract bookmaker name from bet name
   */
  private extractBookmakerFromBetName(betName: string): string {
    const bookmakers = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet'];
    for (const bookmaker of bookmakers) {
      if (betName.toLowerCase().includes(bookmaker.toLowerCase())) {
        return bookmaker;
      }
    }
    return 'Unknown';
  }

  /**
   * Filter bet legs by time period
   */
  private filterByPeriod(betLegs: any[], period: string): any[] {
    const now = new Date();
    let cutoffDate: Date;

    switch (period) {
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'season':
        cutoffDate = new Date(now.getFullYear(), 0, 1); // Start of year
        break;
      case 'all-time':
        return betLegs;
      default:
        return betLegs;
    }

    return betLegs.filter(leg => new Date(leg.bet.createdAt) >= cutoffDate);
  }

  /**
   * Calculate statistics for a set of bet legs
   */
  private calculateStats(betLegs: any[]): {
    totalBets: number;
    averageCLV: Prisma.Decimal;
    positiveCLVCount: number;
    negativeCLVCount: number;
    clvWinRate: Prisma.Decimal;
    expectedROI: Prisma.Decimal;
    actualROI: Prisma.Decimal;
  } {
    const totalBets = betLegs.length;
    const avgCLV = betLegs.reduce((sum, leg) => sum + (leg.clv?.toNumber() || 0), 0) / totalBets;
    const positiveCLVCount = betLegs.filter(leg => leg.clvCategory === 'positive').length;
    const negativeCLVCount = betLegs.filter(leg => leg.clvCategory === 'negative').length;

    // Calculate CLV win rate
    const settledBets = betLegs.filter(leg => leg.status !== 'pending');
    const positiveCLVWins = settledBets.filter(
      leg => leg.clvCategory === 'positive' && leg.status === 'won'
    ).length;
    const positiveCLVTotal = settledBets.filter(leg => leg.clvCategory === 'positive').length;
    const clvWinRate = positiveCLVTotal > 0 ? (positiveCLVWins / positiveCLVTotal) * 100 : 0;

    // Calculate ROI
    const totalStaked = betLegs.reduce((sum, leg) => sum + (leg.bet.stake || 0), 0);
    const totalProfit = betLegs.reduce((sum, leg) => sum + (leg.bet.profit || 0), 0);
    const actualROI = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

    // Expected ROI (simplified: average CLV as proxy)
    const expectedROI = avgCLV;

    return {
      totalBets,
      averageCLV: new Prisma.Decimal(avgCLV.toFixed(2)),
      positiveCLVCount,
      negativeCLVCount,
      clvWinRate: new Prisma.Decimal(clvWinRate.toFixed(2)),
      expectedROI: new Prisma.Decimal(expectedROI.toFixed(2)),
      actualROI: new Prisma.Decimal(actualROI.toFixed(2))
    };
  }

  /**
   * Get nested property from object
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }
}

export const clvService = new CLVService();
