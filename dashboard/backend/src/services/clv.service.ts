import { Prisma } from '@prisma/client';
import type { OddsSnapshot } from '@prisma/client';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

/** A bet leg loaded with its parent bet and the game's sport, as the CLV queries fetch it. */
type BetLegWithBetAndGame = Prisma.BetLegGetPayload<{
  include: { bet: true; game: { include: { sport: true } } };
}>;

/**
 * The `OddsSnapshot` columns the closing-line matcher reads. Declared as a
 * subset of the model so tests must supply real column names, and so callers
 * can pass rows selected with a narrower `select`.
 */
type ClosingLineSnapshot = Pick<
  OddsSnapshot,
  | 'bookmaker'
  | 'marketType'
  | 'homePrice'
  | 'awayPrice'
  | 'homeSpread'
  | 'homeSpreadPrice'
  | 'awaySpread'
  | 'awaySpreadPrice'
  | 'totalLine'
  | 'overPrice'
  | 'underPrice'
  | 'capturedAt'
>;

/** A closing price resolved from a snapshot, with the row it came from. */
interface ClosingLineMatch {
  price: number;
  snapshot: ClosingLineSnapshot;
}

/** `OddsSnapshot.marketType` value that carries each bet leg selection type. */
const MARKET_TYPE_BY_SELECTION_TYPE: Record<string, string> = {
  moneyline: 'h2h',
  spread: 'spreads',
  total: 'totals',
};

/**
 * Half-point tolerance is too wide (-3 and -3.5 are different markets), so a
 * leg's line must match the snapshot's to within rounding noise.
 */
const LINE_MATCH_TOLERANCE = 0.1;

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
        // Find the closing price for this selection in the stored snapshots
        const match = this.findClosingLine(
          game.oddsSnapshots,
          leg.selectionType,
          leg.selection,
          leg.line,
          leg.bookmaker
        );

        if (!match) {
          logger.warn(
            `No matching odds snapshot for bet leg ${leg.id} ` +
            `(${leg.selectionType}/${leg.selection}${leg.line ? ` @ ${leg.line.toString()}` : ''})`
          );
          continue;
        }

        await prisma.betLeg.update({
          where: { id: leg.id },
          data: { closingOdds: match.price },
        });

        logger.info(
          `Captured closing odds for bet leg ${leg.id}: ${match.price} ` +
          `(${match.snapshot.bookmaker} @ ${match.snapshot.capturedAt.toISOString()})`
        );
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
    await this.calculateCLVForBetForUser(betId);
  }

  async calculateCLVForBetForUser(betId: string, userId?: string): Promise<void> {
    try {
      const bet = await prisma.bet.findFirst({
        where: {
          id: betId,
          ...(userId ? { userId } : {}),
        },
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
    userId?: string,
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
      // Build where clause.
      //
      // NOTE: `clv` lives on BetLeg, not Bet — keep the `clv: { not: null }`
      // filter on the outer (BetLeg) where only. Including it under
      // `where.bet.clv` causes Prisma to throw `Unknown arg 'clv'`.
      const betWhere: Prisma.BetWhereInput = {
        ...(userId ? { userId } : {}),
        ...(filters?.betType && { betType: filters.betType }),
      };

      if (filters?.startDate || filters?.endDate) {
        betWhere.placedAt = {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        };
      }

      const where: Prisma.BetLegWhereInput = {
        bet: betWhere,
        clv: { not: null }
      };

      if (filters?.sportKey) {
        where.game = {
          sport: {
            key: filters.sportKey
          }
        };
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
      const bySport = this.groupByField(betLegs, leg => leg.game.sport.key);

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
      logger.error(`Error generating CLV report for user ${userId || 'all-users'}:`, error);
      throw error;
    }
  }

  /**
   * Update aggregated CLV stats for a user
   * Should be called after bets are settled
   */
  async updateCLVStats(userId?: string): Promise<void> {
    try {
      if (!userId) {
        logger.info('Skipping CLV stats update because no scoped user was provided');
        return;
      }

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
   * Find the closing price for a bet leg among a game's odds snapshots.
   *
   * `OddsSnapshot` stores one row per bookmaker/market with a column pair per
   * side (`homePrice`/`awayPrice`, `homeSpreadPrice`/`awaySpreadPrice`,
   * `overPrice`/`underPrice`) — not one row per outcome — so the leg's
   * `selection` ('home' | 'away' | 'over' | 'under') selects the column rather
   * than filtering rows.
   *
   * Snapshots are scanned newest first (`capturedAt`), preferring the book the
   * leg was placed at so CLV compares like with like, and falling back to any
   * book when that one has no usable row. Rows whose price column is empty are
   * skipped so a partially-populated latest snapshot doesn't lose the capture.
   */
  private findClosingLine(
    snapshots: ClosingLineSnapshot[],
    selectionType: string,
    selection: string,
    line: Prisma.Decimal | null,
    bookmaker?: string | null
  ): ClosingLineMatch | null {
    const marketType = MARKET_TYPE_BY_SELECTION_TYPE[selectionType];
    if (!marketType) {
      return null;
    }

    const candidates = snapshots
      .filter(snapshot => snapshot.marketType === marketType)
      .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());

    const sameBookmaker = bookmaker
      ? candidates.filter(
          snapshot => snapshot.bookmaker.toLowerCase() === bookmaker.toLowerCase()
        )
      : [];

    for (const pool of [sameBookmaker, candidates]) {
      for (const snapshot of pool) {
        const price = this.priceForSelection(snapshot, selectionType, selection, line);
        if (price !== null) {
          return { price, snapshot };
        }
      }
    }

    return null;
  }

  /**
   * Read the price a snapshot holds for one selection, or null when the
   * snapshot doesn't cover it (unknown selection, line moved off the leg's
   * number, or an empty price column).
   */
  private priceForSelection(
    snapshot: ClosingLineSnapshot,
    selectionType: string,
    selection: string,
    line: Prisma.Decimal | null
  ): number | null {
    const legLine = line === null || line === undefined ? null : line.toNumber();

    if (selectionType === 'moneyline') {
      if (selection !== 'home' && selection !== 'away') return null;
      return this.toAmericanOdds(
        selection === 'home' ? snapshot.homePrice : snapshot.awayPrice
      );
    }

    if (selectionType === 'spread') {
      if (selection !== 'home' && selection !== 'away') return null;
      // Spreads are stored per side (home -3.5 / away +3.5), matching the side
      // the leg's own line was taken from.
      const snapshotLine =
        selection === 'home' ? snapshot.homeSpread : snapshot.awaySpread;
      if (!this.linesMatch(legLine, snapshotLine)) return null;
      return this.toAmericanOdds(
        selection === 'home' ? snapshot.homeSpreadPrice : snapshot.awaySpreadPrice
      );
    }

    if (selectionType === 'total') {
      if (selection !== 'over' && selection !== 'under') return null;
      if (!this.linesMatch(legLine, snapshot.totalLine)) return null;
      return this.toAmericanOdds(
        selection === 'over' ? snapshot.overPrice : snapshot.underPrice
      );
    }

    return null;
  }

  /**
   * Whether a snapshot's line is the same number the leg was placed at. A leg
   * with no line (moneyline-style) matches anything; a leg with a line needs a
   * snapshot that actually carries one, since CLV is only meaningful when both
   * prices refer to the same market.
   */
  private linesMatch(legLine: number | null, snapshotLine: Prisma.Decimal | null): boolean {
    if (legLine === null) return true;
    if (snapshotLine === null) return false;
    return Math.abs(snapshotLine.toNumber() - legLine) < LINE_MATCH_TOLERANCE;
  }

  /**
   * Normalize a snapshot price column to American odds. The columns are `Int`
   * per schema, but guard against non-numeric or zero values (not a valid
   * American price) rather than persisting them as closing odds.
   */
  private toAmericanOdds(value: number | null): number | null {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) return null;
    return Math.trunc(numeric);
  }

  /**
   * Group bet legs by a field and calculate average CLV
   */
  private groupByField(
    betLegs: BetLegWithBetAndGame[],
    selectKey: (leg: BetLegWithBetAndGame) => string | null | undefined
  ): Array<{ sportKey: string; averageCLV: number; count: number }> {
    const groups = new Map<string, number[]>();

    for (const leg of betLegs) {
      const value = selectKey(leg) || 'unknown';
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
  private groupByBookmaker(betLegs: BetLegWithBetAndGame[]): Array<{ bookmaker: string; averageCLV: number; count: number }> {
    // Extract bookmaker from bet name or use 'unknown'
    const groups = new Map<string, number[]>();

    for (const leg of betLegs) {
      // Prefer the explicit leg.bookmaker field; fall back to name heuristic for legacy rows
      const bookmaker = leg.bookmaker || this.extractBookmakerFromBetName(leg.bet.name);
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
  private filterByPeriod(betLegs: BetLegWithBetAndGame[], period: string): BetLegWithBetAndGame[] {
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
  private calculateStats(betLegs: BetLegWithBetAndGame[]): {
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

    // Calculate ROI.
    //
    // `bet.stake` and `bet.actualPayout` are Prisma Decimals — adding them
    // to a number with `+` produces string concatenation (Decimal#valueOf
    // returns a string), so we must coerce via `.toNumber()` first.
    //
    // The Bet model has no `profit` column, so derive it from
    // `actualPayout - stake` (treating an unsettled `actualPayout` as 0,
    // which yields a -stake contribution — matching the existing semantics
    // used in bet.service.getStats).
    const decimalToNumber = (value: unknown): number => {
      if (value == null) return 0;
      if (typeof value === 'number') return value;
      if (typeof (value as { toNumber?: () => number }).toNumber === 'function') {
        return (value as { toNumber: () => number }).toNumber();
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const totalStaked = betLegs.reduce(
      (sum, leg) => sum + decimalToNumber(leg.bet?.stake),
      0
    );
    const totalProfit = betLegs.reduce(
      (sum, leg) => sum + (decimalToNumber(leg.bet?.actualPayout) - decimalToNumber(leg.bet?.stake)),
      0
    );
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
}

export const clvService = new CLVService();
