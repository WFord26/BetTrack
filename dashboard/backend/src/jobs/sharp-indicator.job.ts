import cron, { ScheduledTask } from 'node-cron';
import { sharpIndicatorService } from '../services/sharp-indicator.service';
import { logger } from '../config/logger';

/**
 * Scheduled job to calculate sharp vs public money indicators.
 *
 * Runs every 15 minutes for all active/upcoming games (next 48 hours,
 * started at most 6 hours ago).
 * Cron: * /15 * * * *
 */

const CRON_EXPRESSION = '*/15 * * * *';

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: { gamesProcessed: number; errors: string[] } | null = null;

async function executeSharpDetection() {
  if (isRunning) {
    logger.warn('Sharp indicator detection already in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  try {
    logger.info('='.repeat(60));
    logger.info('Starting sharp vs public money indicator detection...');

    const startTime = Date.now();
    const result = await sharpIndicatorService.runBatchDetection();
    const duration = Date.now() - startTime;

    lastResult = result;

    if (result.errors.length === 0) {
      logger.info(
        `✅ Sharp indicator detection complete in ${duration}ms — games processed: ${result.gamesProcessed}`
      );
    } else {
      logger.warn(
        `⚠️  Sharp indicator detection finished with ${result.errors.length} error(s) in ${duration}ms`
      );
      result.errors.forEach((e, idx) => logger.warn(`   ${idx + 1}. ${e}`));
    }

    logger.info('='.repeat(60));
  } catch (error) {
    logger.error('Fatal error during sharp indicator detection:', error);
  } finally {
    isRunning = false;
  }
}

export function startSharpIndicatorJob() {
  logger.info(`📅 Scheduling sharp indicator detection job: ${CRON_EXPRESSION}`);

  const task = cron.schedule(CRON_EXPRESSION, executeSharpDetection, {
    timezone: 'America/New_York',
  });

  // Run once immediately on startup
  logger.info('Running initial sharp indicator detection...');
  executeSharpDetection();

  return task;
}

export function stopSharpIndicatorJob(task: ScheduledTask) {
  logger.info('Stopping sharp indicator detection job...');
  task.stop();
}

export function getSharpIndicatorJobStatus() {
  return {
    isRunning,
    lastRunTime,
    lastResult,
    cronExpression: CRON_EXPRESSION,
  };
}
