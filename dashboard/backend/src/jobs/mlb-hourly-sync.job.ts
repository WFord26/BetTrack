import cron from 'node-cron';
import { StatsSyncService } from '../services/stats-sync.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

const statsSyncService = new StatsSyncService();

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: any = null;

async function executeMlbHourlySync() {
  if (isRunning) {
    logger.warn('MLB hourly sync already in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  const minimumRemainingRequests = parseInt(env.API_SPORTS_MIN_REMAINING, 10) || 500;
  const hoursBack = parseInt(env.MLB_SYNC_HOURS_BACK, 10) || 48;
  const hoursForward = parseInt(env.MLB_SYNC_HOURS_FORWARD, 10) || 24;

  try {
    logger.info('='.repeat(60));
    logger.info('Starting hourly MLB sync...');

    const startTime = Date.now();
    const result = await statsSyncService.syncMlbHourlyWindow({
      minimumRemainingRequests,
      hoursBack,
      hoursForward,
    });
    const duration = Date.now() - startTime;

    lastResult = result;

    if (result.errors.length === 0) {
      logger.info(`✅ MLB hourly sync completed in ${duration}ms`);
      logger.info(`   Dates Processed: ${result.datesProcessed}`);
      logger.info(`   Games Processed: ${result.gamesProcessed}`);
      logger.info(`   Games Updated: ${result.gamesUpdated}`);
      if (result.requestsRemaining !== undefined) {
        logger.info(`   API Requests Remaining: ${result.requestsRemaining}`);
      }
      if (result.pausedDueToQuota) {
        logger.warn('   Sync paused early due to quota floor');
      }
    } else {
      logger.error(`❌ MLB hourly sync completed with ${result.errors.length} errors in ${duration}ms`);
      result.errors.slice(0, 10).forEach((error: string, idx: number) => {
        logger.error(`   ${idx + 1}. ${error}`);
      });
    }

    logger.info('='.repeat(60));
  } catch (error) {
    logger.error('Fatal error during MLB hourly sync:', error);
  } finally {
    isRunning = false;
  }
}

export function startMlbHourlySyncJob() {
  if (!env.API_SPORTS_KEY) {
    logger.warn('API_SPORTS_KEY not configured, MLB hourly sync job disabled');
    return null;
  }

  logger.info(`📅 Scheduling MLB hourly sync job: ${env.MLB_SYNC_CRON}`);

  const task = cron.schedule(env.MLB_SYNC_CRON, executeMlbHourlySync, {
    scheduled: true,
    timezone: 'America/New_York',
  });

  logger.info('Running initial MLB hourly sync...');
  executeMlbHourlySync();

  return task;
}

export function getMlbHourlySyncStatus() {
  return {
    isRunning,
    lastRunTime,
    lastResult,
    cronExpression: env.MLB_SYNC_CRON,
  };
}
