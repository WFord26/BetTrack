import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * MarketConsensusService
 *
 * Detects bookmaker disagreement by calculating consensus lines across all
 * bookmakers for a given game/market. High disagreement scores indicate
 * market uncertainty and potential value opportunities.
 *
 * Disagreement Categories:
 *   Low     (0–30):  Normal market efficiency
 *   Medium  (31–60): Some uncertainty
 *   High    (61–80): Significant disagreement
 *   Extreme (81–100): Major market inefficiency
 */

export interface OutlierBookmaker {
  bookmaker: string;
  line: number;
  deviation: number; // How many std devs away from consensus
}

export interface BestValue {
  side: 'home' | 'away' | 'over' | 'under';
  bookmaker: string;
  line: number;
  impliedProb: number;
}

export interface ConsensusResult {
  gameId: string;
  marketType: string;
  consensusLine: number;
  standardDeviation: number;
  outlierBookmakers: OutlierBookmaker[];
  bookmakerCount: number;
  disagreementScore: number;
  bestValue: BestValue;
}

export interface HighDisagreementGame {
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  commenceTime: Date;
  sportKey: string;
  consensus: ConsensusResult[];
  maxDisagreementScore: number;
}

// ─── Math helpers ────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Convert American moneyline to implied probability (no vig)
 */
function americanToImpliedProb(american: number): number {
  if (american > 0) {
    return 100 / (american + 100);
  }
  return Math.abs(american) / (Math.abs(american) + 100);
}

/**
 * Convert implied probability back to American odds
 */
function impliedProbToAmerican(prob: number): number {
  if (prob >= 0.5) {
    return -Math.round((prob / (1 - prob)) * 100);
  }
  return Math.round(((1 - prob) / prob) * 100);
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class MarketConsensusService {
  private readonly MIN_BOOKMAKERS = 2; // Minimum bookmakers required for consensus

  /**
   * Calculate consensus and disagreement score for one game + market type.
   * Uses CurrentOdds (latest per bookmaker/market) for calculation.
   */
  async calculateConsensus(
    gameId: string,
    marketType: 'h2h' | 'spreads' | 'totals'
  ): Promise<ConsensusResult | null> {
    const odds = await prisma.currentOdds.findMany({
      where: { gameId, marketType },
    });

    if (odds.length < this.MIN_BOOKMAKERS) {
      logger.debug(
        `Skipping consensus for game ${gameId} market ${marketType}: only ${odds.length} bookmakers`
      );
      return null;
    }

    let lines: number[];
    let sides: ('home' | 'away' | 'over' | 'under')[];
    let lineValues: number[];

    if (marketType === 'h2h') {
      // Use implied probability of home team for moneyline consensus
      const homeProbs = odds
        .filter((o) => o.homePrice !== null)
        .map((o) => americanToImpliedProb(o.homePrice!));
      const awayProbs = odds
        .filter((o) => o.awayPrice !== null)
        .map((o) => americanToImpliedProb(o.awayPrice!));

      // We work in implied-prob space for moneylines
      lines = homeProbs;
      lineValues = homeProbs;
      sides = Array(homeProbs.length).fill('home');

      const consensusProb = median(homeProbs);
      const dev = stdDev(homeProbs);
      const consensusAmerican = impliedProbToAmerican(consensusProb);
      const score = this.computeScore(dev, consensusProb);

      const outliers = this.findOutliers(
        odds
          .filter((o) => o.homePrice !== null)
          .map((o) => ({
            bookmaker: o.bookmaker,
            value: americanToImpliedProb(o.homePrice!),
          })),
        consensusProb,
        dev
      );

      // Best home value = numerically highest price (most favorable for bettor)
      // Positive odds: +130 is better than +110
      // Negative odds: -105 is better than -150
      const bestHomeOdds = odds
        .filter((o) => o.homePrice !== null)
        .sort((a, b) => b.homePrice! - a.homePrice!)[0]; // descending: highest first

      const bestValue: BestValue = {
        side: 'home',
        bookmaker: bestHomeOdds.bookmaker,
        line: bestHomeOdds.homePrice!,
        impliedProb: americanToImpliedProb(bestHomeOdds.homePrice!),
      };

      return {
        gameId,
        marketType,
        consensusLine: consensusAmerican,
        standardDeviation: parseFloat((dev * 100).toFixed(2)), // as percentage points
        outlierBookmakers: outliers,
        bookmakerCount: odds.length,
        disagreementScore: score,
        bestValue,
      };
    } else if (marketType === 'spreads') {
      const homeLines = odds
        .filter((o) => o.homeSpread !== null)
        .map((o) => parseFloat(o.homeSpread!.toString()));

      const consensusLine = median(homeLines);
      const dev = stdDev(homeLines);
      const score = this.computeScore(dev, Math.abs(consensusLine) || 1);

      const outliers = this.findOutliers(
        odds
          .filter((o) => o.homeSpread !== null)
          .map((o) => ({
            bookmaker: o.bookmaker,
            value: parseFloat(o.homeSpread!.toString()),
          })),
        consensusLine,
        dev
      );

      // Best value = numerically highest spread price (most favorable for bettor)
      // Positive odds: +110 is better than -110
      // Negative odds: -105 is better than -150
      const bestOdds = odds
        .filter((o) => o.homeSpreadPrice !== null)
        .sort((a, b) => b.homeSpreadPrice! - a.homeSpreadPrice!)[0]; // descending: highest first

      const bestValue: BestValue = {
        side: 'home',
        bookmaker: bestOdds?.bookmaker ?? '',
        line: bestOdds?.homeSpread ? parseFloat(bestOdds.homeSpread.toString()) : consensusLine,
        impliedProb: bestOdds?.homeSpreadPrice
          ? americanToImpliedProb(bestOdds.homeSpreadPrice)
          : 0.5,
      };

      return {
        gameId,
        marketType,
        consensusLine,
        standardDeviation: parseFloat(dev.toFixed(2)),
        outlierBookmakers: outliers,
        bookmakerCount: odds.length,
        disagreementScore: score,
        bestValue,
      };
    } else {
      // totals
      const totalLines = odds
        .filter((o) => o.totalLine !== null)
        .map((o) => parseFloat(o.totalLine!.toString()));

      const consensusLine = median(totalLines);
      const dev = stdDev(totalLines);
      const score = this.computeScore(dev, consensusLine || 1);

      const outliers = this.findOutliers(
        odds
          .filter((o) => o.totalLine !== null)
          .map((o) => ({
            bookmaker: o.bookmaker,
            value: parseFloat(o.totalLine!.toString()),
          })),
        consensusLine,
        dev
      );

      // Best over value = numerically highest price (most favorable for bettor)
      // Positive odds: +110 is better than -110
      // Negative odds: -105 is better than -150
      const bestOver = odds
        .filter((o) => o.overPrice !== null)
        .sort((a, b) => b.overPrice! - a.overPrice!)[0]; // descending: highest first

      const bestValue: BestValue = {
        side: 'over',
        bookmaker: bestOver?.bookmaker ?? '',
        line: bestOver?.totalLine ? parseFloat(bestOver.totalLine.toString()) : consensusLine,
        impliedProb: bestOver?.overPrice ? americanToImpliedProb(bestOver.overPrice) : 0.5,
      };

      return {
        gameId,
        marketType,
        consensusLine,
        standardDeviation: parseFloat(dev.toFixed(2)),
        outlierBookmakers: outliers,
        bookmakerCount: odds.length,
        disagreementScore: score,
        bestValue,
      };
    }
  }

  /**
   * Compute disagreement score 1–100 based on coefficient of variation.
   */
  private computeScore(dev: number, referenceValue: number): number {
    const cv = referenceValue !== 0 ? dev / Math.abs(referenceValue) : 0;
    return Math.min(100, Math.max(1, Math.round(cv * 1000)));
  }

  /**
   * Identify bookmakers whose line is > 2 std devs from consensus.
   */
  private findOutliers(
    entries: { bookmaker: string; value: number }[],
    consensus: number,
    dev: number
  ): OutlierBookmaker[] {
    if (dev === 0) return [];
    return entries
      .map((e) => ({
        bookmaker: e.bookmaker,
        line: parseFloat(e.value.toFixed(2)),
        deviation: parseFloat(((e.value - consensus) / dev).toFixed(2)),
      }))
      .filter((e) => Math.abs(e.deviation) > 2);
  }

  /**
   * Persist a ConsensusResult to the database (upsert per game+market).
   */
  async saveConsensus(result: ConsensusResult): Promise<void> {
    await prisma.marketConsensus.create({
      data: {
        gameId: result.gameId,
        marketType: result.marketType,
        consensusLine: result.consensusLine,
        standardDeviation: result.standardDeviation,
        outlierBookmakers: result.outlierBookmakers as any,
        bookmakerCount: result.bookmakerCount,
        disagreementScore: result.disagreementScore,
        bestValue: result.bestValue as any,
      },
    });
  }

  /**
   * Calculate and persist consensus for all market types for a single game.
   */
  async calculateAndSaveForGame(gameId: string): Promise<void> {
    for (const marketType of ['h2h', 'spreads', 'totals'] as const) {
      try {
        const result = await this.calculateConsensus(gameId, marketType);
        if (result) {
          await this.saveConsensus(result);
        }
      } catch (err) {
        logger.error(
          `Error calculating consensus for game ${gameId} market ${marketType}:`,
          err
        );
      }
    }
  }

  /**
   * Run consensus calculation for all upcoming games (next 48 hours).
   * Called by the scheduled job every 15 minutes.
   */
  async runBatchCalculation(): Promise<{ gamesProcessed: number; errors: string[] }> {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const upcomingGames = await prisma.game.findMany({
      where: {
        commenceTime: { gte: now, lte: in48h },
        status: 'scheduled',
      },
      select: { id: true },
    });

    let gamesProcessed = 0;
    const errors: string[] = [];

    for (const game of upcomingGames) {
      try {
        await this.calculateAndSaveForGame(game.id);
        gamesProcessed++;
      } catch (err: any) {
        errors.push(`Game ${game.id}: ${err.message}`);
      }
    }

    return { gamesProcessed, errors };
  }

  /**
   * Return the most recent consensus records for games with high disagreement.
   * Returns one record per game (highest score across markets).
   */
  async findHighDisagreement(
    threshold: number = 60,
    limit: number = 20
  ): Promise<HighDisagreementGame[]> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // last 30 minutes

    const records = await prisma.marketConsensus.findMany({
      where: {
        disagreementScore: { gte: threshold },
        calculatedAt: { gte: cutoff },
      },
      include: {
        game: {
          select: {
            id: true,
            homeTeamName: true,
            awayTeamName: true,
            commenceTime: true,
            sport: { select: { key: true } },
          },
        },
      },
      orderBy: { disagreementScore: 'desc' },
    });

    // Group by gameId
    const gameMap = new Map<string, HighDisagreementGame>();
    for (const r of records) {
      const existing = gameMap.get(r.gameId);
      const consensus: ConsensusResult = {
        gameId: r.gameId,
        marketType: r.marketType,
        consensusLine: parseFloat(r.consensusLine.toString()),
        standardDeviation: parseFloat(r.standardDeviation.toString()),
        outlierBookmakers: r.outlierBookmakers as unknown as OutlierBookmaker[],
        bookmakerCount: r.bookmakerCount,
        disagreementScore: r.disagreementScore,
        bestValue: r.bestValue as unknown as BestValue,
      };

      if (existing) {
        existing.consensus.push(consensus);
        if (r.disagreementScore > existing.maxDisagreementScore) {
          existing.maxDisagreementScore = r.disagreementScore;
        }
      } else {
        gameMap.set(r.gameId, {
          gameId: r.gameId,
          homeTeamName: r.game.homeTeamName,
          awayTeamName: r.game.awayTeamName,
          commenceTime: r.game.commenceTime,
          sportKey: r.game.sport.key,
          consensus: [consensus],
          maxDisagreementScore: r.disagreementScore,
        });
      }
    }

    return Array.from(gameMap.values())
      .sort((a, b) => b.maxDisagreementScore - a.maxDisagreementScore)
      .slice(0, limit);
  }

  /**
   * Return all recent consensus records for a specific game.
   */
  async getDisagreementForGame(gameId: string): Promise<ConsensusResult[]> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000); // last hour

    const records = await prisma.marketConsensus.findMany({
      where: { gameId, calculatedAt: { gte: cutoff } },
      orderBy: { calculatedAt: 'desc' },
    });

    // Deduplicate by market type (keep latest)
    const seen = new Set<string>();
    return records
      .filter((r) => {
        if (seen.has(r.marketType)) return false;
        seen.add(r.marketType);
        return true;
      })
      .map((r) => ({
        gameId: r.gameId,
        marketType: r.marketType,
        consensusLine: parseFloat(r.consensusLine.toString()),
        standardDeviation: parseFloat(r.standardDeviation.toString()),
        outlierBookmakers: r.outlierBookmakers as unknown as OutlierBookmaker[],
        bookmakerCount: r.bookmakerCount,
        disagreementScore: r.disagreementScore,
        bestValue: r.bestValue as unknown as BestValue,
      }));
  }

  /**
   * Return historical disagreement records for a game (all time, ordered).
   */
  async getDisagreementHistory(
    gameId: string,
    marketType?: string
  ): Promise<{ calculatedAt: Date; disagreementScore: number; consensusLine: number }[]> {
    return prisma.marketConsensus.findMany({
      where: {
        gameId,
        ...(marketType ? { marketType } : {}),
      },
      orderBy: { calculatedAt: 'asc' },
      select: {
        calculatedAt: true,
        disagreementScore: true,
        consensusLine: true,
        marketType: true,
      },
    }) as unknown as Promise<{ calculatedAt: Date; disagreementScore: number; consensusLine: number; marketType: string }[]>;
  }

  /**
   * How often each bookmaker appears as an outlier in the last N days.
   */
  async getBookmakerOutlierStats(
    bookmaker: string,
    days: number = 30
  ): Promise<{
    bookmaker: string;
    totalRecords: number;
    outlierCount: number;
    outlierRate: number;
    avgDeviation: number;
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const records = await prisma.marketConsensus.findMany({
      where: { calculatedAt: { gte: since } },
      select: { outlierBookmakers: true },
    });

    let totalRecords = 0;
    let outlierCount = 0;
    let totalDeviation = 0;

    for (const r of records) {
      totalRecords++;
      const outliers = r.outlierBookmakers as unknown as OutlierBookmaker[];
      const match = outliers.find((o) => o.bookmaker === bookmaker);
      if (match) {
        outlierCount++;
        totalDeviation += Math.abs(match.deviation);
      }
    }

    return {
      bookmaker,
      totalRecords,
      outlierCount,
      outlierRate:
        totalRecords > 0
          ? parseFloat(((outlierCount / totalRecords) * 100).toFixed(2))
          : 0,
      avgDeviation:
        outlierCount > 0
          ? parseFloat((totalDeviation / outlierCount).toFixed(2))
          : 0,
    };
  }
}

export const marketConsensusService = new MarketConsensusService();
