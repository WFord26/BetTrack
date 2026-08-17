import cron, { ScheduledTask } from 'node-cron';
import { marketConsensusService } from '../services/market-consensus.service';
import { logger } from '../config/logger';

/**
 * Scheduled job to calculate bookmaker disagreement / market consensus.
 *
 * Runs every 15 minutes for all upcoming games (next 48 hours).
 * Cron: * /15 * * * *
 */

const CRON_EXPRESSION = '*/15 * * * *';

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: { gamesProcessed: number; errors: string[] } | null = null;

async function executeConsensusCalc() {
  if (isRunning) {
    logger.warn('Consensus calculation already in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  try {
    logger.info('='.repeat(60));
    logger.info('Starting consensus / disagreement calculation...');

    const startTime = Date.now();
    const result = await marketConsensusService.runBatchCalculation();
    const duration = Date.now() - startTime;

    lastResult = result;

    if (result.errors.length === 0) {
      logger.info(
        `✅ Consensus calculation complete in ${duration}ms — games processed: ${result.gamesProcessed}`
      );
    } else {
      logger.warn(
        `⚠️  Consensus calculation finished with ${result.errors.length} error(s) in ${duration}ms`
      );
      result.errors.forEach((e, idx) => logger.warn(`   ${idx + 1}. ${e}`));
    }

    logger.info('='.repeat(60));
  } catch (error) {
    logger.error('Fatal error during consensus calculation:', error);
  } finally {
    isRunning = false;
  }
}

export function startConsensusCalcJob() {
  logger.info(`📅 Scheduling consensus calculation job: ${CRON_EXPRESSION}`);

  const task = cron.schedule(CRON_EXPRESSION, executeConsensusCalc, {
    timezone: 'America/New_York',
  });

  // Run once immediately on startup
  logger.info('Running initial consensus calculation...');
  executeConsensusCalc();

  return task;
}

export function stopConsensusCalcJob(task: ScheduledTask) {
  logger.info('Stopping consensus calculation job...');
  task.stop();
}

export function getConsensusCalcStatus() {
  return {
    isRunning,
    lastRunTime,
    lastResult,
    cronExpression: CRON_EXPRESSION,
  };
}
