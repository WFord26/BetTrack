import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { LineMovementService } from '../services/line-movement.service';
import { logger } from '../config/logger';

const lineMovementLogger = logger;
let isRunning = false;
// Tracks the start of the previous successful run so detectMovements can
// skip snapshot pairs whose "after" timestamp was already processed.
let lastRunAt: Date | null = null;

export function initLineMovementJob(prisma: PrismaClient): void {
  const lineMovementService = new LineMovementService();

  // Run every 5 minutes: */5 * * * *
  const job = cron.schedule('*/5 * * * *', async () => {
    if (isRunning) {
      lineMovementLogger.warn('Line movement detection already running, skipping this cycle');
      return;
    }

    isRunning = true;
    const startTime = Date.now();
    const runStartedAt = new Date(startTime);

    try {
      lineMovementLogger.info('Starting line movement detection job');

      // Get active/upcoming games: started at most 6 hours ago (in_progress)
      // up to 48 hours in the future (scheduled). This bounds both ends so
      // stale historical games with a non-completed status are never included.
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const activeGames = await prisma.game.findMany({
        where: {
          commenceTime: {
            gte: sixHoursAgo,
            lte: inTwoDays,
          },
          status: {
            in: ['scheduled', 'in_progress', 'inprogress', 'live'],
          },
        },
        select: { id: true, homeTeamName: true, awayTeamName: true },
      });

      lineMovementLogger.info(`Found ${activeGames.length} active/upcoming games for movement detection`);

      let totalMovementsDetected = 0;

      // Detect movements for each game
      // Use 120 minutes (2 hours) lookback to capture gradual moves (which require
      // timeElapsed > 3600 seconds = 1 hour). Even though the job runs every 5 minutes,
      // a wider window is needed to detect slow drift over extended periods, while
      // sinceTime prevents duplicate persistence on overlapping runs.
      for (const game of activeGames) {
        try {
          const movements = await lineMovementService.detectMovements(game.id, 120, lastRunAt ?? undefined);

          if (movements.length > 0) {
            lineMovementLogger.info(
              `Detected ${movements.length} movements for game ${game.homeTeamName} vs ${game.awayTeamName}`
            );
            totalMovementsDetected += movements.length;

            // Log steam moves prominently
            const steamMoves = movements.filter(m => m.movementType === 'steam');
            for (const move of steamMoves) {
              lineMovementLogger.info(
                `🔥 STEAM MOVE: ${move.marketType} - ${move.bookmakerCount} books, ${move.averageMovement.toString()} points in ${move.timeToMove}s`
              );
            }
          }
        } catch (error) {
          lineMovementLogger.error(`Error processing game ${game.id}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      lineMovementLogger.info(
        `Line movement detection completed: ${totalMovementsDetected} movements detected in ${duration}ms`
      );
      // Only advance the cursor after a fully successful run so a partial
      // failure does not silently skip unprocessed snapshot pairs.
      lastRunAt = runStartedAt;
    } catch (error) {
      lineMovementLogger.error('Error in line movement detection job:', error);
    } finally {
      isRunning = false;
    }
  });

  lineMovementLogger.info('Line movement detection job initialized (runs every 5 minutes)');
  return;
}
