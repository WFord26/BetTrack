import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { clvService } from '../services/clv.service';
import { logger } from '../config/logger';

/**
 * Scheduled job to capture closing lines for games starting soon
 * 
 * Runs every 5 minutes and captures odds for games starting in the next 10 minutes
 * This ensures we get the closing line value (CLV) right before game start
 */

const prisma = new PrismaClient();
const CRON_EXPRESSION = '*/5 * * * *'; // Every 5 minutes

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: { gamesProcessed: number; legsProcessed: number } = { gamesProcessed: 0, legsProcessed: 0 };

/**
 * Execute closing line capture
 */
async function executeCapture() {
  if (isRunning) {
    logger.warn('[CLV Job] Closing line capture already in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  try {
    logger.info('='.repeat(60));
    logger.info('[CLV Job] Starting closing line capture...');
    
    const startTime = Date.now();

    // Find games starting in the next 10 minutes
    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

    const upcomingGames = await prisma.game.findMany({
      where: {
        commenceTime: {
          gte: now,
          lte: tenMinutesFromNow
        },
        status: {
          not: 'final'
        }
      },
      include: {
        betLegs: {
          where: {
            status: 'pending',
            closingOdds: null
          }
        }
      }
    });

    logger.info(`[CLV Job] Found ${upcomingGames.length} games starting soon`);

    let totalLegsProcessed = 0;
    let gamesProcessed = 0;

    // Capture closing lines for each game
    for (const game of upcomingGames) {
      try {
        if (game.betLegs.length > 0) {
          await clvService.captureClosingLine(game.id);
          totalLegsProcessed += game.betLegs.length;
          gamesProcessed++;
          logger.info(`[CLV Job] ✅ Captured closing lines for game ${game.id} (${game.betLegs.length} bet legs)`);
        }
      } catch (error) {
        logger.error(`[CLV Job] ❌ Error capturing closing line for game ${game.id}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    lastResult = {
      gamesProcessed,
      legsProcessed: totalLegsProcessed
    };

    logger.info(`[CLV Job] ✅ Closing line capture completed in ${duration}ms`);
    logger.info(`[CLV Job]    Games: ${gamesProcessed}`);
    logger.info(`[CLV Job]    Bet legs: ${totalLegsProcessed}`);
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('[CLV Job] ❌ Error during closing line capture:', error);
    lastResult = { gamesProcessed: 0, legsProcessed: 0 };
  } finally {
    isRunning = false;
  }
}

/**
 * Get job status
 */
export function getClosingLineCaptureStatus() {
  return {
    isRunning,
    lastRunTime,
    lastResult,
    cronExpression: CRON_EXPRESSION
  };
}

/**
 * Start the closing line capture job
 */
export function startClosingLineCaptureJob() {
  logger.info(`[CLV Job] Starting closing line capture job (cron: ${CRON_EXPRESSION})`);
  
  const task = cron.schedule(CRON_EXPRESSION, executeCapture, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('[CLV Job] ✅ Closing line capture job scheduled successfully');
  
  return task;
}

/**
 * Run the closing line capture job immediately (for testing/manual trigger)
 */
export async function runClosingLineCaptureNow() {
  logger.info('[CLV Job] Manual closing line capture triggered');
  await executeCapture();
}

// Auto-start if ENABLE_CLOSING_LINE_CAPTURE is true
if (process.env.ENABLE_CLOSING_LINE_CAPTURE === 'true') {
  startClosingLineCaptureJob();
  logger.info('[CLV Job] Auto-started closing line capture job');
}
