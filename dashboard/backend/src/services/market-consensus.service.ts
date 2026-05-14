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

type MarketType = 'h2h' | 'spreads' | 'totals';

export interface ConsensusResult {
  gameId: string;
  marketType: MarketType;
  consensusLine: number;
  consensusPrice: number;
  medianLine: number;
  meanLine: number;
  modeLine: number | null;
  standardDeviation: number;
  range: number;
  interquartileRange: number;
  outlierBookmakers: OutlierBookmaker[];
  bestValueSide: BestValue['side'];
  bestValueBookmaker: string;
  bestValueLine: number;
  bookmakerCount: number;
  sharpBookWeight: number;
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

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let topCount = 0;
  let topValue: number | null = null;
  let tie = false;

  for (const [value, count] of counts.entries()) {
    if (count > topCount) {
      topCount = count;
      topValue = value;
      tie = false;
    } else if (count === topCount) {
      tie = true;
    }
  }

  return topCount > 1 && !tie ? topValue : null;
}

function quantile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function interquartileRange(values: number[]): number {
  if (values.length < 2) return 0;
  return quantile(values, 0.75) - quantile(values, 0.25);
}

function valueRange(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
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
  private readonly SHARP_BOOKMAKERS = new Set([
    'pinnacle',
    'circa',
    'bookmaker',
    'bookmaker.eu',
    'betcris',
    'betonlineag',
  ]);

  /**
   * Calculate consensus and disagreement score for one game + market type.
   * Uses CurrentOdds (latest per bookmaker/market) for calculation.
   */
  async calculateConsensus(
    gameId: string,
    marketType: MarketType
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

    if (marketType === 'h2h') {
      // Use implied probability space for moneyline consensus.
      // We must score BOTH sides independently: a market where home prices
      // are stable but away prices diverge is genuine disagreement but
      // would be scored 0 if only home probs are used. We compute deviation
      // and outliers for each side, then take the max score so neither side
      // is silently ignored.
      const homeEntries = odds
        .filter((o) => o.homePrice !== null)
        .map((o) => ({ bookmaker: o.bookmaker, value: americanToImpliedProb(o.homePrice!) }));
      const awayEntries = odds
        .filter((o) => o.awayPrice !== null)
        .map((o) => ({ bookmaker: o.bookmaker, value: americanToImpliedProb(o.awayPrice!) }));

      const homeProbs = homeEntries.map((e) => e.value);
      const awayProbs = awayEntries.map((e) => e.value);

      const consensusHomeProb = median(homeProbs);
      const consensusAwayProb = median(awayProbs);

      const homeDev = stdDev(homeProbs);
      const awayDev = stdDev(awayProbs);

      const homeScore = this.computeScore(homeDev, consensusHomeProb);
      const awayScore = this.computeScore(awayDev, consensusAwayProb);

      // Use the higher-disagreement side for the reported score and stddev.
      const dominantSide = awayScore > homeScore ? 'away' : 'home';
      const score = Math.max(homeScore, awayScore);
      const reportedDev = dominantSide === 'away' ? awayDev : homeDev;

      const homeOutliers = this.findOutliers(homeEntries, consensusHomeProb, homeDev);
      const awayOutliers = this.findOutliers(awayEntries, consensusAwayProb, awayDev);

      // Merge outlier lists; if a bookmaker appears on both sides keep the
      // entry with the larger absolute deviation.
      const outlierMap = new Map<string, OutlierBookmaker>();
      for (const o of [...homeOutliers, ...awayOutliers]) {
        const existing = outlierMap.get(o.bookmaker);
        if (!existing || Math.abs(o.deviation) > Math.abs(existing.deviation)) {
          outlierMap.set(o.bookmaker, o);
        }
      }
      const outliers = Array.from(outlierMap.values());

      // Consensus line reported as home American odds (UI convention).
      const consensusAmerican = impliedProbToAmerican(consensusHomeProb);

      // Best value = numerically highest price across both sides (most favorable for bettor)
      // Positive odds: +130 is better than +110
      // Negative odds: -105 is better than -150
      const bestHomeOdds = odds
        .filter((o) => o.homePrice !== null)
        .sort((a, b) => b.homePrice! - a.homePrice!)[0];
      const bestAwayOdds = odds
        .filter((o) => o.awayPrice !== null)
        .sort((a, b) => b.awayPrice! - a.awayPrice!)[0];

      // Pick whichever side has the better odds
      const usesAway = bestAwayOdds && (!bestHomeOdds || bestAwayOdds.awayPrice! > bestHomeOdds.homePrice!);
      const bestValue: BestValue = usesAway
        ? {
            side: 'away',
            bookmaker: bestAwayOdds!.bookmaker,
            line: bestAwayOdds!.awayPrice!,
            impliedProb: americanToImpliedProb(bestAwayOdds!.awayPrice!),
          }
        : {
            side: 'home',
            bookmaker: bestHomeOdds!.bookmaker,
            line: bestHomeOdds!.homePrice!,
            impliedProb: americanToImpliedProb(bestHomeOdds!.homePrice!),
          };

      const consensusPrice = consensusAmerican;
      const outlierBookmakers = outliers;
      const sharpBookWeight = this.calculateSharpBookWeight(odds.map((o) => o.bookmaker));

      return {
        gameId,
        marketType,
        consensusLine: consensusAmerican,
        consensusPrice,
        medianLine: consensusAmerican,
        meanLine: impliedProbToAmerican(mean(homeProbs)),
        modeLine: null,
        standardDeviation: parseFloat((reportedDev * 100).toFixed(2)), // as percentage points
        range: parseFloat(
          (
            Math.max(...homeProbs, ...awayProbs) - Math.min(...homeProbs, ...awayProbs)
          ).toFixed(2)
        ),
        interquartileRange: parseFloat(
          Math.max(interquartileRange(homeProbs), interquartileRange(awayProbs)).toFixed(2)
        ),
        outlierBookmakers,
        bestValueSide: bestValue.side,
        bestValueBookmaker: bestValue.bookmaker,
        bestValueLine: bestValue.line,
        bookmakerCount: odds.length,
        sharpBookWeight,
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

      // Best value = numerically highest spread price across both sides (most favorable for bettor)
      // Positive odds: +110 is better than -110
      // Negative odds: -105 is better than -150
      const bestHomeSpread = odds
        .filter((o) => o.homeSpreadPrice !== null)
        .sort((a, b) => b.homeSpreadPrice! - a.homeSpreadPrice!)[0];
      const bestAwaySpread = odds
        .filter((o) => o.awaySpreadPrice !== null)
        .sort((a, b) => b.awaySpreadPrice! - a.awaySpreadPrice!)[0];

      // Pick whichever side has the better odds
      const usesAwaySpread = bestAwaySpread && (!bestHomeSpread || bestAwaySpread.awaySpreadPrice! > bestHomeSpread.homeSpreadPrice!);
      const bestValue: BestValue = usesAwaySpread
        ? {
            side: 'away',
            bookmaker: bestAwaySpread!.bookmaker,
            line: bestAwaySpread?.awaySpread ? parseFloat(bestAwaySpread.awaySpread.toString()) : consensusLine,
            impliedProb: bestAwaySpread?.awaySpreadPrice
              ? americanToImpliedProb(bestAwaySpread.awaySpreadPrice)
              : 0.5,
          }
        : {
            side: 'home',
            bookmaker: bestHomeSpread?.bookmaker ?? '',
            line: bestHomeSpread?.homeSpread ? parseFloat(bestHomeSpread.homeSpread.toString()) : consensusLine,
            impliedProb: bestHomeSpread?.homeSpreadPrice
              ? americanToImpliedProb(bestHomeSpread.homeSpreadPrice)
              : 0.5,
          };

      const medianLine = consensusLine;
      const meanLine = mean(homeLines);
      const modeLine = mode(homeLines);
      const dispersionRange = valueRange(homeLines);
      const iqr = interquartileRange(homeLines);
      const consensusPrice = Math.round(median(
        odds
          .filter((o) => o.homeSpreadPrice !== null)
          .map((o) => o.homeSpreadPrice as number)
      ) || 0);
      const sharpBookWeight = this.calculateSharpBookWeight(odds.map((o) => o.bookmaker));

      return {
        gameId,
        marketType,
        consensusLine,
        consensusPrice,
        medianLine: parseFloat(medianLine.toFixed(2)),
        meanLine: parseFloat(meanLine.toFixed(2)),
        modeLine: modeLine === null ? null : parseFloat(modeLine.toFixed(2)),
        standardDeviation: parseFloat(dev.toFixed(2)),
        range: parseFloat(dispersionRange.toFixed(2)),
        interquartileRange: parseFloat(iqr.toFixed(2)),
        outlierBookmakers: outliers,
        bestValueSide: bestValue.side,
        bestValueBookmaker: bestValue.bookmaker,
        bestValueLine: bestValue.line,
        bookmakerCount: odds.length,
        sharpBookWeight,
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

      // Best value = numerically highest price across both sides (most favorable for bettor)
      // Positive odds: +110 is better than -110
      // Negative odds: -105 is better than -150
      const bestOver = odds
        .filter((o) => o.overPrice !== null)
        .sort((a, b) => b.overPrice! - a.overPrice!)[0];
      const bestUnder = odds
        .filter((o) => o.underPrice !== null)
        .sort((a, b) => b.underPrice! - a.underPrice!)[0];

      // Pick whichever side has the better odds
      const usesUnder = bestUnder && (!bestOver || bestUnder.underPrice! > bestOver.overPrice!);
      const bestValue: BestValue = usesUnder
        ? {
            side: 'under',
            bookmaker: bestUnder!.bookmaker,
            line: bestUnder?.totalLine ? parseFloat(bestUnder.totalLine.toString()) : consensusLine,
            impliedProb: bestUnder?.underPrice ? americanToImpliedProb(bestUnder.underPrice) : 0.5,
          }
        : {
            side: 'over',
            bookmaker: bestOver?.bookmaker ?? '',
            line: bestOver?.totalLine ? parseFloat(bestOver.totalLine.toString()) : consensusLine,
            impliedProb: bestOver?.overPrice ? americanToImpliedProb(bestOver.overPrice) : 0.5,
          };

      const medianLine = consensusLine;
      const meanLine = mean(totalLines);
      const modeLine = mode(totalLines);
      const dispersionRange = valueRange(totalLines);
      const iqr = interquartileRange(totalLines);
      const consensusPrice = Math.round(median(
        odds
          .filter((o) => o.overPrice !== null)
          .map((o) => o.overPrice as number)
      ) || 0);
      const sharpBookWeight = this.calculateSharpBookWeight(odds.map((o) => o.bookmaker));

      return {
        gameId,
        marketType,
        consensusLine,
        consensusPrice,
        medianLine: parseFloat(medianLine.toFixed(2)),
        meanLine: parseFloat(meanLine.toFixed(2)),
        modeLine: modeLine === null ? null : parseFloat(modeLine.toFixed(2)),
        standardDeviation: parseFloat(dev.toFixed(2)),
        range: parseFloat(dispersionRange.toFixed(2)),
        interquartileRange: parseFloat(iqr.toFixed(2)),
        outlierBookmakers: outliers,
        bestValueSide: bestValue.side,
        bestValueBookmaker: bestValue.bookmaker,
        bestValueLine: bestValue.line,
        bookmakerCount: odds.length,
        sharpBookWeight,
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

  private calculateSharpBookWeight(bookmakers: string[]): number {
    if (bookmakers.length === 0) return 0;
    const normalized = new Set(bookmakers.map((b) => b.toLowerCase()));
    const sharpCount = Array.from(normalized).filter((b) =>
      this.SHARP_BOOKMAKERS.has(b)
    ).length;
    return parseFloat(((sharpCount / normalized.size) * 100).toFixed(2));
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
        consensusPrice: result.consensusPrice,
        medianLine: result.medianLine,
        meanLine: result.meanLine,
        modeLine: result.modeLine,
        standardDeviation: result.standardDeviation,
        range: result.range,
        interquartileRange: result.interquartileRange,
        outlierBookmakers: result.outlierBookmakers as any,
        bestValueSide: result.bestValueSide,
        bestValueBookmaker: result.bestValueBookmaker,
        bestValueLine: result.bestValueLine,
        bookmakerCount: result.bookmakerCount,
        sharpBookWeight: result.sharpBookWeight,
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
   * Identify consensus outliers for all core market types in a game.
   */
  async identifyOutliers(gameId: string): Promise<
    { marketType: MarketType; outlierBookmakers: OutlierBookmaker[] }[]
  > {
    const results = await Promise.all(
      (['h2h', 'spreads', 'totals'] as const).map(async (marketType) => {
        const consensus = await this.calculateConsensus(gameId, marketType);
        if (!consensus) return null;
        return {
          marketType,
          outlierBookmakers: consensus.outlierBookmakers,
        };
      })
    );

    return results.filter((r): r is { marketType: MarketType; outlierBookmakers: OutlierBookmaker[] } => r !== null);
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
    // Use a wider lookback to find the latest row per game+market (the consensus
    // job runs every 15 min, so 2 h is ample). We must NOT apply the threshold
    // here — that would silently exclude a game whose latest row dropped below
    // the threshold but whose older row from the previous cycle is still visible.
    const lookback = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Step 1: find the most-recent calculatedAt for every gameId+marketType pair.
    const latestByMarket = await prisma.marketConsensus.groupBy({
      by: ['gameId', 'marketType'],
      _max: { calculatedAt: true },
      where: { calculatedAt: { gte: lookback } },
    });

    if (latestByMarket.length === 0) return [];

    // Step 2: fetch only those latest rows, applying the threshold on the
    // current (not stale) score. Also filter to only genuinely pregame games:
    //   - game.status = 'scheduled': excludes in_progress/completed games
    //   - game.commenceTime > now(): guards against delayed status-job updates.
    //     If the status job hasn't advanced a game from 'scheduled' to
    //     'in_progress' yet, the status filter alone won't exclude it. Bounding
    //     by commenceTime ensures games that have already started are never
    //     shown as bettable value opportunities regardless of status lag.
    const now = new Date();
    const records = await prisma.marketConsensus.findMany({
      where: {
        AND: [
          {
            OR: latestByMarket.map(t => ({
              gameId: t.gameId,
              marketType: t.marketType,
              calculatedAt: t._max.calculatedAt!,
            })),
          },
          { disagreementScore: { gte: threshold } },
          { game: { status: 'scheduled', commenceTime: { gt: now } } },
        ],
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
        marketType: r.marketType as MarketType,
        consensusLine: parseFloat(r.consensusLine.toString()),
        consensusPrice: r.consensusPrice,
        medianLine: parseFloat(r.medianLine.toString()),
        meanLine: parseFloat(r.meanLine.toString()),
        modeLine: r.modeLine !== null ? parseFloat(r.modeLine.toString()) : null,
        standardDeviation: parseFloat(r.standardDeviation.toString()),
        range: parseFloat(r.range.toString()),
        interquartileRange: parseFloat(r.interquartileRange.toString()),
        outlierBookmakers: r.outlierBookmakers as unknown as OutlierBookmaker[],
        bestValueSide: r.bestValueSide as BestValue['side'],
        bestValueBookmaker: r.bestValueBookmaker,
        bestValueLine: parseFloat(r.bestValueLine.toString()),
        bookmakerCount: r.bookmakerCount,
        sharpBookWeight: parseFloat(r.sharpBookWeight.toString()),
        disagreementScore: r.disagreementScore,
        bestValue: {
          side: r.bestValueSide as BestValue['side'],
          bookmaker: r.bestValueBookmaker,
          line: parseFloat(r.bestValueLine.toString()),
          impliedProb:
            (r.bestValue as unknown as { impliedProb?: number } | null)?.impliedProb ??
            0.5,
        },
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
        marketType: r.marketType as MarketType,
        consensusLine: parseFloat(r.consensusLine.toString()),
        consensusPrice: r.consensusPrice,
        medianLine: parseFloat(r.medianLine.toString()),
        meanLine: parseFloat(r.meanLine.toString()),
        modeLine: r.modeLine !== null ? parseFloat(r.modeLine.toString()) : null,
        standardDeviation: parseFloat(r.standardDeviation.toString()),
        range: parseFloat(r.range.toString()),
        interquartileRange: parseFloat(r.interquartileRange.toString()),
        outlierBookmakers: r.outlierBookmakers as unknown as OutlierBookmaker[],
        bestValueSide: r.bestValueSide as BestValue['side'],
        bestValueBookmaker: r.bestValueBookmaker,
        bestValueLine: parseFloat(r.bestValueLine.toString()),
        bookmakerCount: r.bookmakerCount,
        sharpBookWeight: parseFloat(r.sharpBookWeight.toString()),
        disagreementScore: r.disagreementScore,
        bestValue: {
          side: r.bestValueSide as BestValue['side'],
          bookmaker: r.bestValueBookmaker,
          line: parseFloat(r.bestValueLine.toString()),
          impliedProb:
            (r.bestValue as unknown as { impliedProb?: number } | null)?.impliedProb ??
            0.5,
        },
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
