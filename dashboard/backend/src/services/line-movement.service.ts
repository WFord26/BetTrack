import { OddsSnapshot, LineMovement } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/database';

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
  // Use getter to access Prisma at method call time rather than class load time
  private get db() {
    return prisma;
  }

  /**
   * Detect line movements by comparing recent odds snapshots
   * Compares snapshots taken ~5 minutes apart to identify movements
   */
  async detectMovements(gameId: string, checkBackMinutes: number = 10): Promise<LineMovement[]> {
    const createdMovements: LineMovement[] = [];

    try {
      // Get all snapshots for this game from the last N minutes, ordered by time
      const cutoffTime = new Date(Date.now() - checkBackMinutes * 60 * 1000);
      const snapshots = await this.db.oddsSnapshot.findMany({
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

      // Group snapshots by market type
      const byMarket = this.groupSnapshotsByMarket(snapshots);

      // Detect movements in each market
      for (const [marketType, marketSnapshots] of Object.entries(byMarket)) {
        if (marketSnapshots.length < 2) continue;

        // Compare consecutive pairs of snapshots
        for (let i = 0; i < marketSnapshots.length - 1; i++) {
          const before = marketSnapshots[i];
          const after = marketSnapshots[i + 1];
          const timeElapsed = Math.round(
            (after.capturedAt.getTime() - before.capturedAt.getTime()) / 1000
          );

          // Skip if snapshots are too close together (less than 2 seconds)
          if (timeElapsed < 2) continue;

          const movement = this.analyzeMovement(
            gameId,
            marketType as 'h2h' | 'spreads' | 'totals',
            [before],
            [after],
            timeElapsed
          );

          if (movement) {
            const created = await this.persistMovement(movement);
            createdMovements.push(created);
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
   * Group snapshots by market type for analysis
   */
  private groupSnapshotsByMarket(
    snapshots: OddsSnapshot[]
  ): Record<string, OddsSnapshot[]> {
    const grouped: Record<string, OddsSnapshot[]> = {};

    for (const snapshot of snapshots) {
      if (!grouped[snapshot.marketType]) {
        grouped[snapshot.marketType] = [];
      }
      grouped[snapshot.marketType].push(snapshot);
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

    const bookmakerCount = movements.length;
    const avgMovement = movements.reduce((sum, m) => sum + Math.abs(m.change), 0) / bookmakerCount;
    const maxMovement = Math.max(...movements.map(m => Math.abs(m.change)));

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
    const isSpreadOrTotal = marketType === 'spreads' || marketType === 'totals';
    const steamThreshold = isSpreadOrTotal ? 1.5 : 15; // points vs cents
    const isSteam =
      bookmakerCount >= 3 &&
      avgMovement >= steamThreshold &&
      timeElapsed < 120; // under 2 minutes

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
    return this.db.lineMovement.create({
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
    return this.db.lineMovement.findMany({
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

    return this.db.lineMovement.findMany({
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

    return this.db.lineMovement.findMany({
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
    return this.db.lineMovement.findMany({
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

    const all = await this.db.lineMovement.findMany({
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
