import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { LineMovementService } from '../services/line-movement.service';
import { logger } from '../config/logger';

const lineMovementLogger = logger;
let isRunning = false;

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

    try {
      lineMovementLogger.info('Starting line movement detection job');

      // Get all active/upcoming games (next 48 hours)
      const now = new Date();
      const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const activeGames = await prisma.game.findMany({
        where: {
          commenceTime: {
            lte: inTwoDays,
          },
          status: {
            in: ['scheduled', 'inprogress', 'live'],
          },
        },
        select: { id: true, homeTeamName: true, awayTeamName: true },
      });

      lineMovementLogger.info(`Found ${activeGames.length} active/upcoming games for movement detection`);

      let totalMovementsDetected = 0;

      // Detect movements for each game
      for (const game of activeGames) {
        try {
          const movements = await lineMovementService.detectMovements(game.id, 10);

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
    } catch (error) {
      lineMovementLogger.error('Error in line movement detection job:', error);
    } finally {
      isRunning = false;
    }
  });

  lineMovementLogger.info('Line movement detection job initialized (runs every 5 minutes)');
  return;
}
