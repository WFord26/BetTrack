import cron from 'node-cron';
import { outcomeResolverService } from '../services/outcome-resolver.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

/**
 * Scheduled job to check game outcomes and settle bets
 * 
 * Runs every N minutes (configured via OUTCOME_CHECK_INTERVAL env var)
 */

const CHECK_INTERVAL = parseInt(env.OUTCOME_CHECK_INTERVAL, 10) || 1;

// Convert minutes to cron expression
// Every N minutes: */N * * * *
const cronExpression = `*/${CHECK_INTERVAL} * * * *`;

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: any = null;

/**
 * Execute outcome resolution
 */
async function executeResolve() {
  if (isRunning) {
    logger.warn('Outcome resolution already in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  try {
    logger.info('='.repeat(60));
    logger.info('Starting scheduled outcome resolution...');
    
    const startTime = Date.now();
    const result = await outcomeResolverService.resolveOutcomes();
    const duration = Date.now() - startTime;

    lastResult = result;

    if (result.success) {
      logger.info(`✅ Outcome resolution completed successfully in ${duration}ms`);
      logger.info(`   Games Checked: ${result.gamesChecked}`);
      logger.info(`   Games Updated: ${result.gamesUpdated}`);
      logger.info(`   Legs Settled: ${result.legsSettled}`);
      logger.info(`   Bets Settled: ${result.betsSettled}`);
    } else {
      logger.error(`❌ Outcome resolution completed with errors in ${duration}ms`);
      logger.error(`   Errors: ${result.errors.length}`);
      result.errors.forEach((error, idx) => {
        logger.error(`   ${idx + 1}. ${error}`);
      });
    }

    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('Fatal error during scheduled outcome resolution:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled job
 */
export function startSettleBetsJob() {
  logger.info(`📅 Scheduling bet settlement job: every ${CHECK_INTERVAL} minutes`);
  logger.info(`   Cron expression: ${cronExpression}`);

  const task = cron.schedule(cronExpression, executeResolve, {
    scheduled: true,
    timezone: 'America/New_York' // Adjust to your timezone
  });

  // Run immediately on startup
  logger.info('Running initial outcome resolution...');
  executeResolve();

  return task;
}

/**
 * Stop the scheduled job
 */
export function stopSettleBetsJob(task: cron.ScheduledTask) {
  logger.info('Stopping bet settlement job...');
  task.stop();
}

/**
 * Get job status
 */
export function getSettleBetsStatus() {
  return {
    isRunning,
    lastRunTime,
    lastResult,
    checkInterval: CHECK_INTERVAL,
    cronExpression
  };
}
