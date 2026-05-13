import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

// ─── Interfaces ───────────────────────────────────────────────────────────────

type MarketType = 'h2h' | 'spreads' | 'totals';
type SharpSide = 'home' | 'away' | 'over' | 'under' | 'none';
type LineMovementCategory = 'steam' | 'reverse' | 'gradual' | 'no_movement';

export interface SharpIndicatorResult {
  gameId: string;
  marketType: MarketType;
  lineMovement: LineMovementCategory;
  sharpSide: SharpSide;
  publicSide: SharpSide;
  sharpConfidence: number;
  contraindicators: string[];
}

export interface ContrarianOpportunity {
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  commenceTime: Date;
  sportKey: string;
  indicators: SharpIndicatorResult[];
  maxConfidence: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Opposite side mapping for contrarian analysis */
function oppositeSide(side: SharpSide): SharpSide {
  switch (side) {
    case 'home':  return 'away';
    case 'away':  return 'home';
    case 'over':  return 'under';
    case 'under': return 'over';
    default:      return 'none';
  }
}

/**
 * Given the before/after line snapshots from a LineMovement record, determine
 * the direction of net movement and map it to home/away/over/under.
 *
 * For h2h: lower homePrice (more negative American odds) → money on home.
 * For spreads: higher homeSpread value (wider spread for home) → money on home.
 * For totals: higher totalLine → money on over.
 */
function inferSteamSide(
  marketType: MarketType,
  linesBefore: Record<string, any>,
  linesAfter: Record<string, any>
): SharpSide {
  const books = Object.keys(linesAfter);
  if (books.length === 0) return 'none';

  if (marketType === 'h2h') {
    let sumBefore = 0;
    let sumAfter = 0;
    let count = 0;
    for (const bk of books) {
      if (
        linesBefore[bk]?.homePrice !== undefined &&
        linesAfter[bk]?.homePrice !== undefined
      ) {
        sumBefore += linesBefore[bk].homePrice;
        sumAfter += linesAfter[bk].homePrice;
        count++;
      }
    }
    if (count === 0) return 'none';
    // More negative homePrice means home is being bet heavily → steam on home.
    return sumAfter < sumBefore ? 'home' : 'away';
  }

  if (marketType === 'spreads') {
    let sumBefore = 0;
    let sumAfter = 0;
    let count = 0;
    for (const bk of books) {
      const before = parseFloat(linesBefore[bk]?.homeSpread ?? 'NaN');
      const after = parseFloat(linesAfter[bk]?.homeSpread ?? 'NaN');
      if (!Number.isNaN(before) && !Number.isNaN(after)) {
        sumBefore += before;
        sumAfter += after;
        count++;
      }
    }
    if (count === 0) return 'none';
    // Larger (more positive or less negative) homeSpread → spread moved away
    // from home → steam on away side.  Smaller homeSpread → steam on home.
    return sumAfter < sumBefore ? 'home' : 'away';
  }

  // totals
  let sumBefore = 0;
  let sumAfter = 0;
  let count = 0;
  for (const bk of books) {
    const before = parseFloat(linesBefore[bk]?.totalLine ?? 'NaN');
    const after = parseFloat(linesAfter[bk]?.totalLine ?? 'NaN');
    if (!Number.isNaN(before) && !Number.isNaN(after)) {
      sumBefore += before;
      sumAfter += after;
      count++;
    }
  }
  if (count === 0) return 'none';
  return sumAfter > sumBefore ? 'over' : 'under';
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SharpIndicatorService {
  /**
   * Analyse recent line movements for a game+market and derive sharp-side /
   * public-side indicators, together with a 1-10 confidence score.
   *
   * Algorithm:
   *   1. Fetch line-movement records for the game from the last 12 hours.
   *   2. Classify the dominant movement type (steam > reverse > gradual > none).
   *   3. Determine which side sharp money flowed based on movement direction.
   *   4. Build confidence score from signal strength / consistency.
   *   5. Collect contraindicators that should temper the signal.
   */
  async detectSharpSide(gameId: string, marketType: MarketType): Promise<SharpIndicatorResult | null> {
    const lookback = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const movements = await prisma.lineMovement.findMany({
      where: { gameId, marketType, detectedAt: { gte: lookback } },
      orderBy: { detectedAt: 'desc' },
    });

    const steamMoves = movements.filter(m => m.movementType === 'steam');
    const reverseMoves = movements.filter(m => m.movementType === 'reverse');
    const gradualMoves = movements.filter(m => m.movementType === 'gradual');

    // Determine dominant movement category
    let lineMovement: LineMovementCategory;
    if (steamMoves.length > 0) {
      lineMovement = 'steam';
    } else if (reverseMoves.length > 0) {
      lineMovement = 'reverse';
    } else if (gradualMoves.length > 0) {
      lineMovement = 'gradual';
    } else {
      lineMovement = 'no_movement';
    }

    // Determine sharp side from the most informative movements
    let sharpSide: SharpSide = 'none';
    const primaryMoves = steamMoves.length > 0 ? steamMoves : reverseMoves;

    if (primaryMoves.length > 0) {
      // Tally direction votes across all primary moves
      const sideCounts: Record<SharpSide, number> = {
        home: 0, away: 0, over: 0, under: 0, none: 0,
      };

      for (const mv of primaryMoves) {
        const side = inferSteamSide(
          marketType,
          mv.linesBefore as Record<string, any>,
          mv.linesAfter as Record<string, any>
        );
        sideCounts[side]++;
      }

      // Pick the side with the most votes (excluding 'none')
      const voted = (Object.entries(sideCounts) as [SharpSide, number][])
        .filter(([s]) => s !== 'none')
        .sort(([, a], [, b]) => b - a);

      if (voted.length > 0 && voted[0][1] > 0) {
        sharpSide = voted[0][0];
      }
    }

    const publicSide: SharpSide = sharpSide !== 'none' ? oppositeSide(sharpSide) : 'none';

    // ── Confidence score (1-10) ────────────────────────────────────────────
    const { score: sharpConfidence, contraindicators } = this.calculateConfidence({
      lineMovement,
      movements,
      steamMoves,
      reverseMoves,
      sharpSide,
    });

    return {
      gameId,
      marketType,
      lineMovement,
      sharpSide,
      publicSide,
      sharpConfidence,
      contraindicators,
    };
  }

  /**
   * Calculate confidence score (1-10) and collect contraindicators.
   */
  calculateConfidence(params: {
    lineMovement: LineMovementCategory;
    movements: any[];
    steamMoves: any[];
    reverseMoves: any[];
    sharpSide: SharpSide;
  }): { score: number; contraindicators: string[] } {
    const { lineMovement, movements, steamMoves, reverseMoves, sharpSide } = params;
    const contraindicators: string[] = [];
    let score = 5; // Base confidence

    if (lineMovement === 'no_movement' || sharpSide === 'none') {
      return { score: 1, contraindicators: ['no_signal'] };
    }

    // Steam moves boost confidence
    if (steamMoves.length >= 3) {
      score += 3;
    } else if (steamMoves.length >= 2) {
      score += 2;
    } else if (steamMoves.length >= 1) {
      score += 1;
    }

    // Reverse moves add moderate confidence
    if (reverseMoves.length >= 2) {
      score += 1;
    }

    // Bookmaker consensus: average bookmakerCount across steam moves
    const primaryMoves = steamMoves.length > 0 ? steamMoves : reverseMoves;
    const avgBookmakers = primaryMoves.length > 0
      ? primaryMoves.reduce((sum: number, m: any) => sum + m.bookmakerCount, 0) / primaryMoves.length
      : 0;

    if (avgBookmakers >= 5) {
      score += 1;
    } else if (avgBookmakers < 3) {
      contraindicators.push('low_bookmaker_count');
      score -= 1;
    }

    // Recent signal boost (steam in last 2 hours)
    const recentCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentSteam = steamMoves.filter((m: any) => new Date(m.detectedAt) >= recentCutoff);
    if (recentSteam.length > 0) {
      score += 1;
    }

    // Mixed signals — steam moves pointing in different directions
    if (steamMoves.length > 1) {
      const sides = steamMoves.map((m: any) =>
        inferSteamSide(
          m.marketType as MarketType,
          m.linesBefore as Record<string, any>,
          m.linesAfter as Record<string, any>
        )
      );
      const uniqueSides = new Set(sides.filter(s => s !== 'none'));
      if (uniqueSides.size > 1) {
        contraindicators.push('mixed_signals');
        score -= 2;
      }
    }

    // Only gradual movement available
    if (lineMovement === 'gradual' && steamMoves.length === 0 && reverseMoves.length === 0) {
      contraindicators.push('gradual_movement_only');
      score = Math.min(score, 4);
    }

    // Stale data (no movements in last 4 hours)
    const staleCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const hasRecentData = movements.some((m: any) => new Date(m.detectedAt) >= staleCutoff);
    if (!hasRecentData) {
      contraindicators.push('stale_data');
      score -= 1;
    }

    return {
      score: Math.min(10, Math.max(1, score)),
      contraindicators,
    };
  }

  /**
   * Persist a SharpIndicatorResult to the database.
   */
  async saveIndicator(result: SharpIndicatorResult): Promise<void> {
    await prisma.sharpMoneyIndicator.create({
      data: {
        gameId: result.gameId,
        marketType: result.marketType,
        lineMovement: result.lineMovement,
        sharpSide: result.sharpSide,
        publicSide: result.publicSide,
        sharpConfidence: result.sharpConfidence,
        contraindicators: result.contraindicators,
      },
    });
  }

  /**
   * Calculate and persist indicators for all three market types for one game.
   */
  async calculateAndSaveForGame(gameId: string): Promise<void> {
    for (const marketType of ['h2h', 'spreads', 'totals'] as const) {
      try {
        const result = await this.detectSharpSide(gameId, marketType);
        if (result) {
          await this.saveIndicator(result);
        }
      } catch (err) {
        logger.error(
          `Error calculating sharp indicator for game ${gameId} market ${marketType}:`,
          err
        );
      }
    }
  }

  /**
   * Run batch detection across all active/upcoming games.
   * Called by the scheduled job.
   */
  async runBatchDetection(): Promise<{ gamesProcessed: number; errors: string[] }> {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const games = await prisma.game.findMany({
      where: {
        status: { in: ['scheduled', 'in_progress'] },
        commenceTime: { lte: in48h, gte: sixHoursAgo },
      },
      select: { id: true },
    });

    let gamesProcessed = 0;
    const errors: string[] = [];

    for (const game of games) {
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
   * Return the most recent sharp indicator for each active game.
   * One row per game (highest confidence across market types).
   */
  async getLatestIndicators(limit: number = 20): Promise<any[]> {
    const lookback = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const now = new Date();

    // Get latest calculatedAt per game+marketType
    const latestByMarket = await prisma.sharpMoneyIndicator.groupBy({
      by: ['gameId', 'marketType'],
      _max: { calculatedAt: true },
      where: { calculatedAt: { gte: lookback } },
    });

    if (latestByMarket.length === 0) return [];

    const records = await prisma.sharpMoneyIndicator.findMany({
      where: {
        OR: latestByMarket.map(t => ({
          gameId: t.gameId,
          marketType: t.marketType,
          calculatedAt: t._max.calculatedAt!,
        })),
        sharpSide: { not: 'none' },
        game: {
          commenceTime: { gt: now },
          status: 'scheduled',
        },
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
      orderBy: { sharpConfidence: 'desc' },
      take: limit * 3, // over-fetch to allow grouping
    });

    // Group by gameId, keep highest-confidence record per game
    const gameMap = new Map<string, any>();
    for (const r of records) {
      const existing = gameMap.get(r.gameId);
      if (!existing || r.sharpConfidence > existing.sharpConfidence) {
        gameMap.set(r.gameId, r);
      }
    }

    return Array.from(gameMap.values())
      .sort((a, b) => b.sharpConfidence - a.sharpConfidence)
      .slice(0, limit);
  }

  /**
   * Return all sharp indicators for a specific game (latest per market type).
   */
  async getIndicatorsForGame(gameId: string): Promise<any[]> {
    const lookback = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const latestByMarket = await prisma.sharpMoneyIndicator.groupBy({
      by: ['gameId', 'marketType'],
      _max: { calculatedAt: true },
      where: { gameId, calculatedAt: { gte: lookback } },
    });

    if (latestByMarket.length === 0) return [];

    return prisma.sharpMoneyIndicator.findMany({
      where: {
        OR: latestByMarket.map(t => ({
          gameId: t.gameId,
          marketType: t.marketType,
          calculatedAt: t._max.calculatedAt!,
        })),
      },
      orderBy: { sharpConfidence: 'desc' },
    });
  }

  /**
   * Find contrarian opportunities: games where sharp money is backing the
   * less-popular side (i.e., confidence >= minConfidence).
   */
  async findContrarianOpportunities(minConfidence: number = 6, limit: number = 20): Promise<ContrarianOpportunity[]> {
    const lookback = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const now = new Date();

    const latestByMarket = await prisma.sharpMoneyIndicator.groupBy({
      by: ['gameId', 'marketType'],
      _max: { calculatedAt: true },
      where: { calculatedAt: { gte: lookback } },
    });

    if (latestByMarket.length === 0) return [];

    const records = await prisma.sharpMoneyIndicator.findMany({
      where: {
        OR: latestByMarket.map(t => ({
          gameId: t.gameId,
          marketType: t.marketType,
          calculatedAt: t._max.calculatedAt!,
        })),
        sharpConfidence: { gte: minConfidence },
        sharpSide: { not: 'none' },
        game: {
          status: 'scheduled',
          commenceTime: { gt: now },
        },
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
      orderBy: { sharpConfidence: 'desc' },
    });

    // Group by gameId
    const gameMap = new Map<string, ContrarianOpportunity>();
    for (const r of records) {
      const indicator: SharpIndicatorResult = {
        gameId: r.gameId,
        marketType: r.marketType as MarketType,
        lineMovement: r.lineMovement as LineMovementCategory,
        sharpSide: r.sharpSide as SharpSide,
        publicSide: r.publicSide as SharpSide,
        sharpConfidence: r.sharpConfidence,
        contraindicators: r.contraindicators,
      };

      const existing = gameMap.get(r.gameId);
      if (existing) {
        existing.indicators.push(indicator);
        if (r.sharpConfidence > existing.maxConfidence) {
          existing.maxConfidence = r.sharpConfidence;
        }
      } else {
        gameMap.set(r.gameId, {
          gameId: r.gameId,
          homeTeamName: r.game.homeTeamName,
          awayTeamName: r.game.awayTeamName,
          commenceTime: r.game.commenceTime,
          sportKey: r.game.sport.key,
          indicators: [indicator],
          maxConfidence: r.sharpConfidence,
        });
      }
    }

    return Array.from(gameMap.values())
      .sort((a, b) => b.maxConfidence - a.maxConfidence)
      .slice(0, limit);
  }

  /**
   * Get summary stats for sharp indicators over the last N hours.
   */
  async getStats(hoursBack: number = 24): Promise<{
    byMarket: Record<string, number>;
    bySharpSide: Record<string, number>;
    byLineMovement: Record<string, number>;
    avgConfidence: number;
    totalIndicators: number;
  }> {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const rows = await prisma.sharpMoneyIndicator.findMany({
      where: { calculatedAt: { gte: cutoff }, sharpSide: { not: 'none' } },
      select: { marketType: true, sharpSide: true, lineMovement: true, sharpConfidence: true },
    });

    const byMarket: Record<string, number> = {};
    const bySharpSide: Record<string, number> = {};
    const byLineMovement: Record<string, number> = {};
    let confidenceSum = 0;

    for (const r of rows) {
      byMarket[r.marketType] = (byMarket[r.marketType] || 0) + 1;
      bySharpSide[r.sharpSide] = (bySharpSide[r.sharpSide] || 0) + 1;
      byLineMovement[r.lineMovement] = (byLineMovement[r.lineMovement] || 0) + 1;
      confidenceSum += r.sharpConfidence;
    }

    return {
      byMarket,
      bySharpSide,
      byLineMovement,
      avgConfidence: rows.length > 0 ? parseFloat((confidenceSum / rows.length).toFixed(2)) : 0,
      totalIndicators: rows.length,
    };
  }
}

export const sharpIndicatorService = new SharpIndicatorService();
