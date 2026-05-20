import { BookmakerAnalytics, CurrentOdds, MarketConsensus, OddsSnapshot } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

type RankCriteria =
  | 'value'
  | 'sharpness'
  | 'reliability'
  | 'coverage'
  | 'limits'
  | 'recommendation';

interface MovementFollower {
  bookmaker?: string;
  lagSeconds?: number;
}

interface ConsensusOutlier {
  bookmaker?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return parseFloat(value.toFixed(2));
}

function toDecimal(value: number): Decimal {
  return new Decimal(round2(value).toString());
}

function getComparableLine(odds: CurrentOdds, consensus: MarketConsensus): number | null {
  if (odds.marketType === 'h2h') {
    return odds.homePrice ?? null;
  }

  if (odds.marketType === 'spreads') {
    if (odds.homeSpread == null) return null;
    return parseFloat(odds.homeSpread.toString());
  }

  if (odds.marketType === 'totals') {
    if (!odds.totalLine) return null;
    return parseFloat(odds.totalLine.toString());
  }

  return null;
}

export class BookmakerAnalyticsService {
  private readonly LOOKBACK_DAYS = 30;
  private readonly EFFICIENCY_MARGIN_MULTIPLIER = 10;
  private readonly EFFICIENCY_OUTLIER_WEIGHT = 0.5;
  private readonly SHARPNESS_WEIGHTS = {
    firstMoverFrequency: 0.5,
    bestOddsFrequency: 0.3,
    marketEfficiency: 0.2,
  } as const;
  private readonly RECOMMENDATION_WEIGHTS = {
    value: 0.4,
    reliability: 0.35,
    coverage: 0.15,
    sharpness: 0.1,
  } as const;
  private readonly COVERAGE_MARKET_TARGET = 200;
  private readonly SHARP_RATING_HIGH_THRESHOLD = 8;
  private readonly SHARP_RATING_MEDIUM_THRESHOLD = 5;
  private readonly MAX_BET_HIGH_LIMIT = 5000;
  private readonly MAX_BET_MEDIUM_LIMIT = 1500;
  private readonly MAX_BET_LOW_LIMIT = 500;

  async calculateBookmakerMetrics(bookmaker: string): Promise<BookmakerAnalytics> {
    const normalizedBookmaker = bookmaker.trim().toLowerCase();

    if (!normalizedBookmaker) {
      throw new Error('bookmaker is required');
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - this.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    // Phase 1: fetch this bookmaker's current odds; guard against unknown bookmakers
    const currentOdds = await prisma.currentOdds.findMany({
      where: {
        bookmaker: normalizedBookmaker,
        game: {
          commenceTime: { gte: cutoff },
        },
      },
      include: {
        game: {
          select: {
            sport: {
              select: {
                key: true,
              },
            },
          },
        },
      },
    });

    if (currentOdds.length === 0) {
      throw Object.assign(new Error('bookmaker not found'), { code: 'BOOKMAKER_NOT_FOUND' });
    }

    // Phase 2: scope consensus and supporting data to this bookmaker's game IDs at the DB layer
    const gameIds = Array.from(new Set(currentOdds.map((row) => row.gameId)));
    const offeredMarketTypes = Array.from(new Set(currentOdds.map((row) => row.marketType)));

    const [consensusRows, movementEvents, snapshots] = await Promise.all([
      prisma.marketConsensus.findMany({
        where: {
          calculatedAt: { gte: cutoff },
          gameId: { in: gameIds },
          marketType: { in: offeredMarketTypes },
        },
        orderBy: {
          calculatedAt: 'desc',
        },
      }),
      prisma.bookmakerMovementEvent.findMany({
        where: {
          detectedAt: { gte: cutoff },
        },
      }),
      prisma.oddsSnapshot.findMany({
        where: {
          bookmaker: normalizedBookmaker,
          capturedAt: { gte: cutoff },
        },
        orderBy: {
          capturedAt: 'asc',
        },
      }),
    ]);

    // consensusRows are already scoped to this bookmaker's games and market types
    const eligibleConsensus = consensusRows;

    const bestOddsHits = eligibleConsensus.filter(
      (row) => row.bestValueBookmaker.toLowerCase() === normalizedBookmaker
    ).length;

    const outlierHits = eligibleConsensus.filter((row) => {
      const outliers = (row.outlierBookmakers as ConsensusOutlier[]) ?? [];
      return outliers.some(
        (entry) => entry.bookmaker?.toLowerCase() === normalizedBookmaker
      );
    }).length;

    const marginSamples: number[] = [];
    const consensusByKey = new Map<string, typeof eligibleConsensus[number]>();
    for (const row of eligibleConsensus) {
      const key = `${row.gameId}:${row.marketType}`;
      if (!consensusByKey.has(key)) {
        consensusByKey.set(key, row);
      }
    }

    for (const oddsRow of currentOdds) {
      const consensus = consensusByKey.get(`${oddsRow.gameId}:${oddsRow.marketType}`);
      if (!consensus) continue;

      const bookLine = getComparableLine(oddsRow, consensus);
      if (bookLine === null) continue;

      const consensusLine = parseFloat(consensus.consensusLine.toString());
      marginSamples.push(Math.abs(bookLine - consensusLine));
    }

    const marginVsConsensus =
      marginSamples.length > 0
        ? marginSamples.reduce((sum, value) => sum + value, 0) / marginSamples.length
        : 0;

    const eventsForBookmaker = movementEvents.filter((event) => {
      if (event.firstMover.toLowerCase() === normalizedBookmaker) {
        return true;
      }

      const followers = (event.followers as MovementFollower[]) ?? [];
      return followers.some(
        (entry) => entry.bookmaker?.toLowerCase() === normalizedBookmaker
      );
    });

    const firstMoverCount = eventsForBookmaker.filter(
      (event) => event.firstMover.toLowerCase() === normalizedBookmaker
    ).length;

    const lagSamples: number[] = [];
    for (const event of eventsForBookmaker) {
      const followers = (event.followers as MovementFollower[]) ?? [];
      const match = followers.find(
        (entry) => entry.bookmaker?.toLowerCase() === normalizedBookmaker
      );
      if (typeof match?.lagSeconds === 'number') {
        lagSamples.push(match.lagSeconds);
      }
    }

    const firstMoverFrequency =
      eventsForBookmaker.length > 0
        ? (firstMoverCount / eventsForBookmaker.length) * 100
        : 0;
    const lineMovementLag =
      lagSamples.length > 0
        ? Math.round(lagSamples.reduce((sum, value) => sum + value, 0) / lagSamples.length)
        : 0;

    const bestOddsFrequency =
      eligibleConsensus.length > 0
        ? (bestOddsHits / eligibleConsensus.length) * 100
        : 0;
    const outlierFrequency =
      eligibleConsensus.length > 0
        ? (outlierHits / eligibleConsensus.length) * 100
        : 0;

    const totalGamesOffered = new Set(currentOdds.map((row) => row.gameId)).size;
    const totalMarketsOffered = currentOdds.length;

    const sportsCovered = Array.from(
      new Set(
        currentOdds
          .map((row) => row.game.sport.key)
          .filter((key): key is string => Boolean(key))
      )
    ).sort();

    const marketsCovered = Array.from(
      new Set(currentOdds.map((row) => row.marketType))
    ).sort();

    const marketEfficiency = clamp(
      100 -
        marginVsConsensus * this.EFFICIENCY_MARGIN_MULTIPLIER -
        outlierFrequency * this.EFFICIENCY_OUTLIER_WEIGHT,
      0,
      100
    );

    const sharpBookRating = Math.round(
      clamp(
        (firstMoverFrequency * this.SHARPNESS_WEIGHTS.firstMoverFrequency +
          bestOddsFrequency * this.SHARPNESS_WEIGHTS.bestOddsFrequency +
          marketEfficiency * this.SHARPNESS_WEIGHTS.marketEfficiency) /
          10,
        1,
        10
      )
    );

    const uptimePercentage: number | null = null; // TODO(uptime-tracking): no data source yet; fill via user-submitted reports in a future phase

    const updateDiffs: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const diffSeconds = Math.round(
        (snapshots[i].capturedAt.getTime() - snapshots[i - 1].capturedAt.getTime()) / 1000
      );
      if (diffSeconds > 0) {
        updateDiffs.push(diffSeconds);
      }
    }

    const oddsUpdateFrequency =
      updateDiffs.length > 0
        ? Math.round(updateDiffs.reduce((sum, value) => sum + value, 0) / updateDiffs.length)
        : 0;

    const latestSnapshot = snapshots[snapshots.length - 1]?.capturedAt;
    const averageOddsAge = latestSnapshot
      ? Math.max(0, Math.round((now.getTime() - latestSnapshot.getTime()) / 1000))
      : 0;

    const averageCLVOfferedRaw = await prisma.betLeg.aggregate({
      where: {
        bookmaker: normalizedBookmaker,
        clv: { not: null },
      },
      _avg: { clv: true },
    });
    const averageCLVOffered: number | null =
      averageCLVOfferedRaw._avg.clv != null
        ? parseFloat(averageCLVOfferedRaw._avg.clv.toString())
        : null;

    const limitProfile =
      sharpBookRating >= this.SHARP_RATING_HIGH_THRESHOLD
        ? 'high'
        : sharpBookRating >= this.SHARP_RATING_MEDIUM_THRESHOLD
          ? 'medium'
          : 'low';
    const estimatedMaxBet =
      limitProfile === 'high'
        ? this.MAX_BET_HIGH_LIMIT
        : limitProfile === 'medium'
          ? this.MAX_BET_MEDIUM_LIMIT
          : this.MAX_BET_LOW_LIMIT;

    const valueScore =
      (bestOddsFrequency +
        (100 -
          clamp(
            marginVsConsensus * this.EFFICIENCY_MARGIN_MULTIPLIER,
            0,
            100
          ))) /
      2;
    const reliabilityScore = (marketEfficiency) / 2; // uptimePercentage excluded until data source exists
    const coverageScore = clamp(
      (totalMarketsOffered / this.COVERAGE_MARKET_TARGET) * 100,
      0,
      100
    );
    // recommendationScore is null when any weighted input is unavailable
    const hasAllInputs = firstMoverFrequency !== null && bestOddsFrequency !== null && marketEfficiency !== null;
    const recommendationScore: number | null = hasAllInputs
      ? Math.round(
          clamp(
            valueScore * this.RECOMMENDATION_WEIGHTS.value +
              reliabilityScore * this.RECOMMENDATION_WEIGHTS.reliability +
              coverageScore * this.RECOMMENDATION_WEIGHTS.coverage +
              sharpBookRating * 10 * this.RECOMMENDATION_WEIGHTS.sharpness,
            1,
            100
          )
        )
      : null;

    const analytics = await prisma.bookmakerAnalytics.upsert({
      where: {
        bookmaker: normalizedBookmaker,
      },
      create: {
        bookmaker: normalizedBookmaker,
        averageCLVOffered: averageCLVOffered,
        bestOddsFrequency: toDecimal(bestOddsFrequency),
        marginVsConsensus: toDecimal(marginVsConsensus),
        outlierFrequency: toDecimal(outlierFrequency),
        firstMoverFrequency: toDecimal(firstMoverFrequency),
        lineMovementLag,
        sharpBookRating,
        marketEfficiency: toDecimal(marketEfficiency),
        sportsCovered,
        marketsCovered,
        uptimePercentage: uptimePercentage,
        oddsUpdateFrequency,
        averageOddsAge,
        limitProfile,
        estimatedMaxBet: toDecimal(estimatedMaxBet),
        accountLimitReports: 0,
        totalGamesOffered,
        totalMarketsOffered,
        averageMargin: toDecimal(marginVsConsensus),
        userRating: null,
        userReviewCount: 0,
        recommendationScore,
      },
      update: {
        averageCLVOffered: averageCLVOffered,
        bestOddsFrequency: toDecimal(bestOddsFrequency),
        marginVsConsensus: toDecimal(marginVsConsensus),
        outlierFrequency: toDecimal(outlierFrequency),
        firstMoverFrequency: toDecimal(firstMoverFrequency),
        lineMovementLag,
        sharpBookRating,
        marketEfficiency: toDecimal(marketEfficiency),
        sportsCovered,
        marketsCovered,
        uptimePercentage: uptimePercentage,
        oddsUpdateFrequency,
        averageOddsAge,
        limitProfile,
        estimatedMaxBet: toDecimal(estimatedMaxBet),
        totalGamesOffered,
        totalMarketsOffered,
        averageMargin: toDecimal(marginVsConsensus),
        recommendationScore,
        calculatedAt: now,
      },
    });

    logger.info(
      `Calculated bookmaker analytics for ${normalizedBookmaker}: score=${recommendationScore}`
    );

    return analytics;
  }

  async runBatchCalculation(): Promise<{ bookmakersProcessed: number; errors: string[] }> {
    const errors: string[] = [];
    const rows = await prisma.currentOdds.findMany({
      select: { bookmaker: true },
      distinct: ['bookmaker'],
    });
    const bookmakers = rows.map((r) => r.bookmaker).filter(Boolean);

    for (const bookmaker of bookmakers) {
      try {
        await this.calculateBookmakerMetrics(bookmaker);
      } catch (e) {
        errors.push(`${bookmaker}: ${(e as Error).message}`);
      }
    }

    return { bookmakersProcessed: bookmakers.length, errors };
  }

  async rankBookmakers(criteria: string): Promise<BookmakerAnalytics[]> {
    const normalizedCriteria = criteria.toLowerCase() as RankCriteria;

    const orderByMap: Record<RankCriteria, any[]> = {
      value: [{ bestOddsFrequency: 'desc' }, { averageCLVOffered: 'desc' }],
      sharpness: [{ sharpBookRating: 'desc' }, { firstMoverFrequency: 'desc' }],
      reliability: [{ uptimePercentage: 'desc' }, { marketEfficiency: 'desc' }],
      coverage: [{ totalMarketsOffered: 'desc' }, { totalGamesOffered: 'desc' }],
      limits: [{ estimatedMaxBet: 'desc' }, { sharpBookRating: 'desc' }],
      recommendation: [{ recommendationScore: 'desc' }, { sharpBookRating: 'desc' }],
    };

    const orderBy = orderByMap[normalizedCriteria] ?? orderByMap.recommendation;

    return prisma.bookmakerAnalytics.findMany({
      orderBy,
      take: 50,
    });
  }
}

export const bookmakerAnalyticsService = new BookmakerAnalyticsService();
