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

function snapshotHourKey(timestamp: Date): string {
  return timestamp.toISOString().slice(0, 13);
}

function getComparableLine(odds: CurrentOdds, consensus: MarketConsensus): number | null {
  if (odds.marketType === 'h2h') {
    return odds.homePrice;
  }

  if (odds.marketType === 'spreads') {
    if (!odds.homeSpread) return null;
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

  async calculateBookmakerMetrics(bookmaker: string): Promise<BookmakerAnalytics> {
    const normalizedBookmaker = bookmaker.trim().toLowerCase();

    if (!normalizedBookmaker) {
      throw new Error('bookmaker is required');
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - this.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const [currentOdds, consensusRows, movementEvents, snapshots] = await Promise.all([
      prisma.currentOdds.findMany({
        where: { bookmaker: normalizedBookmaker },
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
      }),
      prisma.marketConsensus.findMany({
        where: {
          calculatedAt: { gte: cutoff },
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

    const offeredKeys = new Set(currentOdds.map((row) => `${row.gameId}:${row.marketType}`));
    const eligibleConsensus = consensusRows.filter((row) =>
      offeredKeys.has(`${row.gameId}:${row.marketType}`)
    );

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
    const consensusByKey = new Map(
      eligibleConsensus.map((row) => [`${row.gameId}:${row.marketType}`, row])
    );

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

    const marketEfficiency = clamp(100 - marginVsConsensus * 10 - outlierFrequency * 0.5, 0, 100);

    const sharpBookRating = Math.round(
      clamp((firstMoverFrequency * 0.5 + bestOddsFrequency * 0.3 + marketEfficiency * 0.2) / 10, 1, 10)
    );

    const snapshotHours = new Set(snapshots.map((snapshot) => snapshotHourKey(snapshot.capturedAt))).size;
    const earliestSnapshot = snapshots[0]?.capturedAt;
    const spanHours = earliestSnapshot
      ? Math.max(1, Math.ceil((now.getTime() - earliestSnapshot.getTime()) / (60 * 60 * 1000)))
      : 1;

    const uptimePercentage = snapshots.length > 0 ? (snapshotHours / spanHours) * 100 : 0;

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

    const averageCLVOffered = bestOddsFrequency - outlierFrequency;

    const limitProfile = sharpBookRating >= 8 ? 'high' : sharpBookRating >= 5 ? 'medium' : 'low';
    const estimatedMaxBet =
      limitProfile === 'high' ? 5000 : limitProfile === 'medium' ? 1500 : 500;

    const valueScore = (bestOddsFrequency + (100 - clamp(marginVsConsensus * 10, 0, 100))) / 2;
    const reliabilityScore = (uptimePercentage + marketEfficiency) / 2;
    const coverageScore = clamp((totalMarketsOffered / 200) * 100, 0, 100);
    const recommendationScore = Math.round(
      clamp(valueScore * 0.4 + reliabilityScore * 0.35 + coverageScore * 0.15 + sharpBookRating * 10 * 0.1, 1, 100)
    );

    const analytics = await prisma.bookmakerAnalytics.upsert({
      where: {
        bookmaker: normalizedBookmaker,
      },
      create: {
        bookmaker: normalizedBookmaker,
        averageCLVOffered: toDecimal(averageCLVOffered),
        bestOddsFrequency: toDecimal(bestOddsFrequency),
        marginVsConsensus: toDecimal(marginVsConsensus),
        outlierFrequency: toDecimal(outlierFrequency),
        firstMoverFrequency: toDecimal(firstMoverFrequency),
        lineMovementLag,
        sharpBookRating,
        marketEfficiency: toDecimal(marketEfficiency),
        sportsCovered,
        marketsCovered,
        uptimePercentage: toDecimal(uptimePercentage),
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
        averageCLVOffered: toDecimal(averageCLVOffered),
        bestOddsFrequency: toDecimal(bestOddsFrequency),
        marginVsConsensus: toDecimal(marginVsConsensus),
        outlierFrequency: toDecimal(outlierFrequency),
        firstMoverFrequency: toDecimal(firstMoverFrequency),
        lineMovementLag,
        sharpBookRating,
        marketEfficiency: toDecimal(marketEfficiency),
        sportsCovered,
        marketsCovered,
        uptimePercentage: toDecimal(uptimePercentage),
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
