import cron from 'node-cron';
import { oddsSyncService } from '../services/odds-sync.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

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

  } catch (error) {
    logger.error('Fatal error during scheduled odds sync:', error);
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
    scheduled: true,
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
export function stopOddsSyncJob(task: cron.ScheduledTask) {
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
