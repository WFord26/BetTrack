import cron from 'node-cron';
import { bookmakerAnalyticsService } from '../services/bookmaker-analytics.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Scheduled job to compute and persist BookmakerAnalytics rows for every
 * bookmaker currently present in CurrentOdds.
 *
 * Route handlers read from the persisted table; they do NOT recompute
 * on demand (see ADR-018: Analytics Aggregation Pattern).
 *
 * Cron: 0 2 * * * — daily at 02:00 UTC
 */

const CRON_EXPRESSION = '0 2 * * *';

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: { bookmakersProcessed: number; errors: string[] } | null = null;

async function executeBookmakerAnalytics() {
  if (isRunning) {
    logger.warn('Bookmaker analytics job already in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  try {
    logger.info('='.repeat(60));
    logger.info('Starting bookmaker analytics batch calculation...');

    const startTime = Date.now();
    const result = await bookmakerAnalyticsService.runBatchCalculation();
    const duration = Date.now() - startTime;

    lastResult = result;

    if (result.errors.length === 0) {
      logger.info(
        `✅ Bookmaker analytics complete in ${duration}ms — bookmakers processed: ${result.bookmakersProcessed}`
      );
    } else {
      logger.warn(
        `⚠️  Bookmaker analytics finished with ${result.errors.length} error(s) in ${duration}ms`
      );
      result.errors.forEach((e, idx) => logger.warn(`   ${idx + 1}. ${e}`));
    }

    logger.info('='.repeat(60));
  } catch (error) {
    logger.error('Fatal error during bookmaker analytics calculation:', error);
  } finally {
    isRunning = false;
  }
}

export async function startBookmakerAnalyticsJob() {
  logger.info(`📅 Scheduling bookmaker analytics job: ${CRON_EXPRESSION}`);

  const task = cron.schedule(CRON_EXPRESSION, executeBookmakerAnalytics, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Run immediately on startup if the table is empty or data is stale (>48h old)
  const latestRow = await prisma.bookmakerAnalytics
    .findFirst({ orderBy: { calculatedAt: 'desc' }, select: { calculatedAt: true } })
    .catch(() => null);

  const staleThresholdMs = 48 * 60 * 60 * 1000;
  const isStale =
    !latestRow || Date.now() - latestRow.calculatedAt.getTime() > staleThresholdMs;

  if (isStale) {
    logger.info(
      latestRow
        ? 'Bookmaker analytics data is stale (>48h); running initial calculation...'
        : 'Bookmaker analytics table is empty; running initial calculation...'
    );
    executeBookmakerAnalytics();
  }

  return task;
}

export function stopBookmakerAnalyticsJob(task: cron.ScheduledTask) {
  logger.info('Stopping bookmaker analytics job...');
  task.stop();
}

export function getBookmakerAnalyticsJobStatus() {
  return {
    isRunning,
    lastRunTime,
    lastResult,
  };
}
