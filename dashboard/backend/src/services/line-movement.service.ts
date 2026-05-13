import { OddsSnapshot, LineMovement, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface LineMovementData {
  gameId: string;
  marketType: 'h2h' | 'spreads' | 'totals';
  movementType: 'steam' | 'reverse' | 'gradual' | 'injury' | 'normal';
  linesBefore: Record<string, any>;
  linesAfter: Record<string, any>;
  bookmakerCount: number;
  averageMovement: number;
  timeToMove: number;
  maxMovement?: number;
  suspectedCause?: string;
}

interface OddsMovementSnapshot {
  bookmaker: string;
  priceH2H?: number;
  spreadLine?: number;
  spreadPrice?: number;
  totalLine?: number;
  overPrice?: number;
}

export class LineMovementService {
  /**
   * Detect line movements by comparing recent odds snapshots
   * Groups snapshots by sync timestamp, then compares across consecutive sync cycles
   * This enables detection of multi-bookmaker movements (steam moves)
   *
   * @param sinceTime - Only persist movements whose "after" snapshot is newer than
   *   this timestamp. The lookback window is kept wider so the service always has a
   *   "before" batch to compare against, but snapshot pairs that were already
   *   processed by a previous job run are skipped, preventing duplicate rows from
   *   overlapping detection windows.
   */
  async detectMovements(gameId: string, checkBackMinutes: number = 10, sinceTime?: Date): Promise<LineMovement[]> {
    const createdMovements: LineMovement[] = [];

    try {
      // Get all snapshots for this game from the last N minutes, ordered by time
      const cutoffTime = new Date(Date.now() - checkBackMinutes * 60 * 1000);
      const snapshots = await prisma.oddsSnapshot.findMany({
        where: {
          gameId,
          capturedAt: {
            gte: cutoffTime,
          },
        },
        orderBy: { capturedAt: 'asc' },
      });

      if (snapshots.length < 2) {
        return createdMovements;
      }

      // Group snapshots by market type AND sync timestamp
      // This lets us analyze all bookmakers from each sync cycle together
      const byMarketAndTime = this.groupSnapshotsByMarketAndTime(snapshots);

      // For each market type, compare consecutive sync cycles
      for (const [marketType, syncBatches] of Object.entries(byMarketAndTime)) {
        if (syncBatches.size < 2) continue;

        const sortedTimes = Array.from(syncBatches.keys()).sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );

        // Pass 1: Compare consecutive sync cycles (~10-min pairs).
        // This handles steam and normal moves which require a short timeElapsed.
        for (let i = 0; i < sortedTimes.length - 1; i++) {
          const beforeTime = sortedTimes[i];
          const afterTime = sortedTimes[i + 1];
          const beforeSnapshots = syncBatches.get(beforeTime)!;
          const afterSnapshots = syncBatches.get(afterTime)!;

          const timeElapsed = Math.round(
            (new Date(afterTime).getTime() - new Date(beforeTime).getTime()) / 1000
          );

          // Skip if snapshots are too close together (less than 2 seconds)
          if (timeElapsed < 2) continue;

          const movement = this.analyzeMovement(
            gameId,
            marketType as 'h2h' | 'spreads' | 'totals',
            beforeSnapshots,
            afterSnapshots,
            timeElapsed
          );

          if (movement) {
            // Skip pairs whose "after" batch has already been processed by a
            // previous job run. Without this guard, overlapping lookback windows
            // would insert duplicate rows for the same snapshot transition.
            if (sinceTime && new Date(afterTime) <= sinceTime) {
              continue;
            }
            const created = await this.persistMovement(movement);
            createdMovements.push(created);
          }
        }

        // Pass 2: Gradual-detection pass.
        // Consecutive pairs above span only one sync interval (~10 min, ~600 s),
        // which is far below the classifyMovement 'gradual' threshold of
        // timeElapsed > 3600 s. With a 120-min lookback the full window spans
        // ~7200 s, so comparing the oldest batch directly against the newest
        // batch satisfies the threshold and surfaces slow drift over time.
        // We skip when there are only 2 batches because that pair was already
        // evaluated by Pass 1 (identical comparison, no new information).
        // We restrict persistence to 'gradual' results only so Pass 1's steam
        // and normal classifications are never double-persisted for the boundary.
        if (sortedTimes.length > 2) {
          const oldestTime = sortedTimes[0];
          const latestTime = sortedTimes[sortedTimes.length - 1];

          if (!(sinceTime && new Date(latestTime) <= sinceTime)) {
            const timeElapsed = Math.round(
              (new Date(latestTime).getTime() - new Date(oldestTime).getTime()) / 1000
            );

            if (timeElapsed > 2) {
              const movement = this.analyzeMovement(
                gameId,
                marketType as 'h2h' | 'spreads' | 'totals',
                syncBatches.get(oldestTime)!,
                syncBatches.get(latestTime)!,
                timeElapsed
              );

              if (movement && movement.movementType === 'gradual') {
                const created = await this.persistMovement(movement);
                createdMovements.push(created);
              }
            }
          }
        }
      }

      return createdMovements;
    } catch (error) {
      console.error(`Error detecting movements for game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Group snapshots by market type AND sync timestamp (capturedAt)
   * Returns: Record<marketType, Map<timestamp, OddsSnapshot[]>>
   * 
   * This groups all bookmakers from the same sync cycle together,
   * enabling detection of multi-bookmaker movements (steam moves)
   */
  private groupSnapshotsByMarketAndTime(
    snapshots: OddsSnapshot[]
  ): Record<string, Map<string, OddsSnapshot[]>> {
    const grouped: Record<string, Map<string, OddsSnapshot[]>> = {};

    for (const snapshot of snapshots) {
      if (!grouped[snapshot.marketType]) {
        grouped[snapshot.marketType] = new Map();
      }

      const timeKey = snapshot.capturedAt.toISOString();
      const timeMap = grouped[snapshot.marketType];
      
      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, []);
      }
      
      timeMap.get(timeKey)!.push(snapshot);
    }

    return grouped;
  }

  /**
   * Analyze movement between two snapshots
   * Classifies as steam, reverse, gradual, or normal
   */
  private analyzeMovement(
    gameId: string,
    marketType: 'h2h' | 'spreads' | 'totals',
    beforeSnapshots: OddsSnapshot[],
    afterSnapshots: OddsSnapshot[],
    timeElapsed: number
  ): LineMovementData | null {
    const linesBefore = this.buildLineSnapshot(beforeSnapshots);
    const linesAfter = this.buildLineSnapshot(afterSnapshots);

    // Calculate changes per bookmaker
    const changes = this.calculateLineChanges(
      marketType,
      linesBefore,
      linesAfter
    );

    if (Object.keys(changes).length === 0) {
      return null;
    }

    const movements = Object.values(changes).filter(m => m.change !== 0);
    if (movements.length === 0) return null;

    // Partition movers by direction so that a split market (some books up,
    // some books down) is never classified as steam. Steam requires coordinated
    // movement: 3+ books all moving the same way in the same window.
    const upMovers   = movements.filter(m => m.change > 0);
    const downMovers = movements.filter(m => m.change < 0);

    // The dominant group is whichever direction had more books move. On a tie
    // we pick the group with the larger average absolute change. This group's
    // count and average are what we pass to classifyMovement so the steam
    // thresholds are evaluated against coordinated-only movement.
    let dominantGroup: typeof movements;
    if (upMovers.length > downMovers.length) {
      dominantGroup = upMovers;
    } else if (downMovers.length > upMovers.length) {
      dominantGroup = downMovers;
    } else {
      // Equal split — pick the group with larger average absolute move
      const upAvg   = upMovers.reduce((s, m) => s + Math.abs(m.change), 0)   / (upMovers.length   || 1);
      const downAvg = downMovers.reduce((s, m) => s + Math.abs(m.change), 0) / (downMovers.length || 1);
      dominantGroup = upAvg >= downAvg ? upMovers : downMovers;
    }

    // bookmakerCount and avgMovement reflect only the coordinated movers
    const bookmakerCount = dominantGroup.length;
    const avgMovement    = dominantGroup.reduce((sum, m) => sum + Math.abs(m.change), 0) / bookmakerCount;
    // maxMovement still considers all movers (useful metadata even for non-steam)
    const maxMovement    = Math.max(...movements.map(m => Math.abs(m.change)));

    // Classify the movement
    const classification = this.classifyMovement(
      marketType,
      bookmakerCount,
      avgMovement,
      maxMovement,
      timeElapsed
    );

    return {
      gameId,
      marketType,
      movementType: classification.type,
      linesBefore,
      linesAfter,
      bookmakerCount,
      averageMovement: avgMovement,
      timeToMove: timeElapsed,
      maxMovement,
      suspectedCause: classification.cause,
    };
  }

  /**
   * Build a snapshot of all lines from bookmakers
   */
  private buildLineSnapshot(snapshots: OddsSnapshot[]): Record<string, any> {
    const snapshot: Record<string, any> = {};

    for (const s of snapshots) {
      snapshot[s.bookmaker] = {
        homePrice: s.homePrice,
        awayPrice: s.awayPrice,
        homeSpread: s.homeSpread,
        homeSpreadPrice: s.homeSpreadPrice,
        awaySpread: s.awaySpread,
        awaySpreadPrice: s.awaySpreadPrice,
        totalLine: s.totalLine,
        overPrice: s.overPrice,
        underPrice: s.underPrice,
      };
    }

    return snapshot;
  }

  /**
   * Calculate line changes per bookmaker
   */
  private calculateLineChanges(
    marketType: 'h2h' | 'spreads' | 'totals',
    before: Record<string, any>,
    after: Record<string, any>
  ): Record<string, { change: number; before: number; after: number }> {
    const changes: Record<string, { change: number; before: number; after: number }> = {};

    for (const bookmaker of Object.keys(after)) {
      if (!before[bookmaker]) continue;

      const beforeData = before[bookmaker];
      const afterData = after[bookmaker];
      let change = 0;
      let beforeVal = 0;
      let afterVal = 0;

      if (marketType === 'h2h') {
        // For moneyline, track home odds changes (in cents)
        beforeVal = beforeData.homePrice || 0;
        afterVal = afterData.homePrice || 0;
        change = afterVal - beforeVal;
      } else if (marketType === 'spreads') {
        // For spreads, track home spread line changes
        beforeVal = parseFloat(beforeData.homeSpread || 0);
        afterVal = parseFloat(afterData.homeSpread || 0);
        change = Math.round((afterVal - beforeVal) * 100) / 100;
      } else if (marketType === 'totals') {
        // For totals, track total line changes
        beforeVal = parseFloat(beforeData.totalLine || 0);
        afterVal = parseFloat(afterData.totalLine || 0);
        change = Math.round((afterVal - beforeVal) * 100) / 100;
      }

      if (Math.abs(change) > 0.01) {
        changes[bookmaker] = { change, before: beforeVal, after: afterVal };
      }
    }

    return changes;
  }

  /**
   * Classify movement type based on criteria
   * Steam: 3+ books move 1.5+ points in <2min in same direction (spreads/totals)
   *        or 3+ books move 15+ cents in same direction (moneyline)
   * Reverse: line moves against public betting
   * Gradual: slow drift over hours with <1 point average
   * Injury: suspected injury/news event
   */
  private classifyMovement(
    marketType: 'h2h' | 'spreads' | 'totals',
    bookmakerCount: number,
    avgMovement: number,
    maxMovement: number,
    timeElapsed: number
  ): { type: 'steam' | 'reverse' | 'gradual' | 'injury' | 'normal'; cause?: string } {
    // Steam move thresholds
    // The odds sync job runs every 10 minutes by default, so consecutive sync
    // batches produce timeElapsed ≈ 600 s. A strict <120 s threshold would
    // downgrade every coordinated multi-book move to 'normal' under normal
    // operation. We use <900 s (15 min) to accommodate the default 10-minute
    // sync interval plus reasonable timing variance, while still distinguishing
    // steam (rapid, within one sync window) from gradual (timeElapsed > 3600 s).
    const isSpreadOrTotal = marketType === 'spreads' || marketType === 'totals';
    const steamThreshold = isSpreadOrTotal ? 1.5 : 15; // points vs cents
    const isSteam =
      bookmakerCount >= 3 &&
      avgMovement >= steamThreshold &&
      timeElapsed < 900; // within one ~10-min sync window (with buffer)

    if (isSteam) {
      return { type: 'steam', cause: 'Rapid line movement across multiple bookmakers' };
    }

    // Gradual move
    if (timeElapsed > 3600 && avgMovement < 1.0) {
      return { type: 'gradual', cause: 'Slow drift over extended period' };
    }

    // For reverse detection, we would need to compare with public bet data
    // This is a simplified version that looks for counter-intuitive movement
    // In practice, this requires integration with betting volume data

    return { type: 'normal' };
  }

  /**
   * Persist a detected movement to the database
   */
  private async persistMovement(movement: LineMovementData): Promise<LineMovement> {
    return prisma.lineMovement.create({
      data: {
        gameId: movement.gameId,
        marketType: movement.marketType,
        movementType: movement.movementType,
        linesBefore: movement.linesBefore,
        linesAfter: movement.linesAfter,
        bookmakerCount: movement.bookmakerCount,
        averageMovement: new Decimal(movement.averageMovement.toString()),
        timeToMove: movement.timeToMove,
        maxMovement: movement.maxMovement
          ? new Decimal(movement.maxMovement.toString())
          : null,
        suspectedCause: movement.suspectedCause,
      },
    });
  }

  /**
   * Get recent movements for a specific game
   */
  async getGameMovements(
    gameId: string,
    limit: number = 50
  ): Promise<LineMovement[]> {
    return prisma.lineMovement.findMany({
      where: { gameId },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent movements by type
   */
  async getMovementsByType(
    movementType: 'steam' | 'reverse' | 'gradual' | 'injury',
    hoursBack: number = 24
  ): Promise<LineMovement[]> {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    return prisma.lineMovement.findMany({
      where: {
        movementType,
        detectedAt: { gte: cutoff },
      },
      orderBy: { detectedAt: 'desc' },
      include: { game: true },
    });
  }

  /**
   * Get all movements from the last N hours
   */
  async getRecentMovements(hoursBack: number = 24): Promise<(LineMovement & { game: any })[]> {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    logger.info(`getRecentMovements: prisma type is ${typeof prisma}`);
    logger.info(`getRecentMovements: prisma.lineMovement is ${typeof prisma.lineMovement}`);
    logger.info(`getRecentMovements: prisma.lineMovement value is ${prisma.lineMovement}`);

    return prisma.lineMovement.findMany({
      where: {
        detectedAt: { gte: cutoff },
      },
      include: { game: true },
      orderBy: { detectedAt: 'desc' },
    });
  }

  /**
   * Get steam moves (most important for bettors)
   */
  async getSteamMoves(limit: number = 20): Promise<(LineMovement & { game: any })[]> {
    return prisma.lineMovement.findMany({
      where: { movementType: 'steam' },
      include: { game: true },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get movement statistics
   */
  async getMovementStats(
    hoursBack: number = 24
  ): Promise<{ byType: Record<string, number>; byMarket: Record<string, number> }> {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const all = await prisma.lineMovement.findMany({
      where: { detectedAt: { gte: cutoff } },
    });

    const byType: Record<string, number> = {
      steam: 0,
      reverse: 0,
      gradual: 0,
      injury: 0,
      normal: 0,
    };

    const byMarket: Record<string, number> = {
      h2h: 0,
      spreads: 0,
      totals: 0,
    };

    for (const move of all) {
      byType[move.movementType]++;
      byMarket[move.marketType]++;
    }

    return { byType, byMarket };
  }
}
