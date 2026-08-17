import cron, { ScheduledTask } from 'node-cron';
import { oddsSyncService } from '../services/odds-sync.service';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { emitOddsSyncCompleted } from '../events/odds-sync.events';

/**
 * Scheduled job to sync odds from The Odds API
 * 
 * Runs every N minutes (configured via ODDS_SYNC_INTERVAL env var)
 */

const SYNC_INTERVAL = parseInt(env.ODDS_SYNC_INTERVAL, 10) || 10;

// Convert minutes to cron expression
// Every N minutes: */N * * * *
const cronExpression = `*/${SYNC_INTERVAL} * * * *`;

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: any = null;

/**
 * Execute odds sync
 */
async function executeSync() {
  if (isRunning) {
    logger.warn('Odds sync already in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  try {
    logger.info('='.repeat(60));
    logger.info('Starting scheduled odds sync...');
    
    const startTime = Date.now();
    const result = await oddsSyncService.syncAllOdds();
    const duration = Date.now() - startTime;

    lastResult = result;

    if (result.success) {
      logger.info(`✅ Odds sync completed successfully in ${duration}ms`);
      logger.info(`   Games: ${result.gamesProcessed}`);
      logger.info(`   Odds: ${result.oddsProcessed}`);
      logger.info(`   Snapshots: ${result.snapshotsCreated}`);
      if (result.requestsRemaining !== undefined) {
        logger.info(`   API Requests Remaining: ${result.requestsRemaining}`);
      }
    } else {
      logger.error(`❌ Odds sync completed with errors in ${duration}ms`);
      logger.error(`   Errors: ${result.errors.length}`);
      result.errors.forEach((error, idx) => {
        logger.error(`   ${idx + 1}. ${error}`);
      });
    }

    logger.info('='.repeat(60));

    // Let downstream analytics (arbitrage detection) react to fresh odds
    // instead of polling on a cadence they cannot align with.
    emitOddsSyncCompleted({
      success: result.success,
      gamesProcessed: result.gamesProcessed,
      oddsProcessed: result.oddsProcessed,
      completedAt: new Date(),
    });

  } catch (error) {
    logger.error('Fatal error during scheduled odds sync:', error);
    emitOddsSyncCompleted({
      success: false,
      gamesProcessed: 0,
      oddsProcessed: 0,
      completedAt: new Date(),
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled job
 */
export function startOddsSyncJob() {
  logger.info(`📅 Scheduling odds sync job: every ${SYNC_INTERVAL} minutes`);
  logger.info(`   Cron expression: ${cronExpression}`);

  const task = cron.schedule(cronExpression, executeSync, {
    timezone: 'America/New_York' // Adjust to your timezone
  });

  // Run immediately on startup
  logger.info('Running initial odds sync...');
  executeSync();

  return task;
}

/**
 * Stop the scheduled job
 */
export function stopOddsSyncJob(task: ScheduledTask) {
  logger.info('Stopping odds sync job...');
  task.stop();
}

/**
 * Get job status
 */
export function getOddsSyncStatus() {
  return {
    isRunning,
    lastRunTime,
    lastResult,
    syncInterval: SYNC_INTERVAL,
    cronExpression
  };
}
