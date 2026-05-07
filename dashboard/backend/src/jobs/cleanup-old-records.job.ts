import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Scheduled job to clean up old data records
 * 
 * Removes:
 * - OddsSnapshot records older than 30 days
 * - ApiKeyUsage records older than 90 days
 * 
 * Runs daily at 2 AM UTC
 */

const CLEANUP_CRON_EXPRESSION = '0 2 * * *'; // 2 AM UTC daily (timezone forced below)
const CLEANUP_TIMEZONE = 'UTC';

// Batch size for deletes — keeps individual statements small enough to
// avoid long table-level locks once history grows large.
const DELETE_BATCH_SIZE = 5_000;
// Hard cap on iterations per run to bound a single cleanup invocation.
const MAX_BATCHES_PER_RUN = 200;

let isRunning = false;
let lastRunTime: Date | null = null;

/**
 * Delete records in chunks so a single statement never tries to remove
 * millions of rows at once. Returns total rows deleted across all batches.
 */
async function deleteInBatches(
  tableLabel: string,
  deleteBatch: () => Promise<{ count: number }>
): Promise<number> {
  let total = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const result = await deleteBatch();
    total += result.count;
    if (result.count < DELETE_BATCH_SIZE) {
      // Last batch was a partial — nothing more to delete.
      return total;
    }
  }

  logger.warn(
    `${tableLabel}: hit MAX_BATCHES_PER_RUN cap (${MAX_BATCHES_PER_RUN}), ` +
    `${total} rows removed; will continue on next scheduled run.`
  );
  return total;
}

/**
 * Delete old odds snapshots (30-day retention)
 */
async function deleteOldOddsSnapshots() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const total = await deleteInBatches('odds_snapshots', async () => {
      // Prisma doesn't support LIMIT on deleteMany directly, so emulate
      // it via a subquery on the primary key.
      const ids = await prisma.oddsSnapshot.findMany({
        where: { capturedAt: { lt: thirtyDaysAgo } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
      });
      if (ids.length === 0) return { count: 0 };

      return prisma.oddsSnapshot.deleteMany({
        where: { id: { in: ids.map((row) => row.id) } },
      });
    });

    logger.info(`📊 Deleted ${total} old odds snapshots (older than 30 days)`);
    return total;
  } catch (error) {
    logger.error('Failed to delete old odds snapshots:', error);
    throw error;
  }
}

/**
 * Delete old API key usage records (90-day retention)
 */
async function deleteOldApiKeyUsage() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  try {
    const total = await deleteInBatches('api_key_usage', async () => {
      const ids = await prisma.apiKeyUsage.findMany({
        where: { createdAt: { lt: ninetyDaysAgo } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
      });
      if (ids.length === 0) return { count: 0 };

      return prisma.apiKeyUsage.deleteMany({
        where: { id: { in: ids.map((row) => row.id) } },
      });
    });

    logger.info(`🔐 Deleted ${total} old API key usage records (older than 90 days)`);
    return total;
  } catch (error) {
    logger.error('Failed to delete old API key usage records:', error);
    throw error;
  }
}

/**
 * Execute cleanup tasks
 */
async function executeCleanup() {
  if (isRunning) {
    logger.warn('Data cleanup already in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  try {
    logger.info('='.repeat(60));
    logger.info('Starting scheduled data cleanup...');
    
    const startTime = Date.now();
    
    const oddsSnapshotsDeleted = await deleteOldOddsSnapshots();
    const apiKeyUsageDeleted = await deleteOldApiKeyUsage();
    
    const duration = Date.now() - startTime;

    logger.info(`✅ Data cleanup completed successfully in ${duration}ms`);
    logger.info(`   OddsSnapshots deleted: ${oddsSnapshotsDeleted}`);
    logger.info(`   ApiKeyUsage deleted: ${apiKeyUsageDeleted}`);
    logger.info('='.repeat(60));
  } catch (error) {
    logger.error('❌ Data cleanup failed:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize cleanup job
 */
export function initializeCleanupJob() {
  logger.info(`Scheduling cleanup job to run at: ${CLEANUP_CRON_EXPRESSION} (2 AM ${CLEANUP_TIMEZONE})`);
  // Pin the cron schedule to UTC explicitly — node-cron defaults to the
  // host timezone, which would silently shift the run time on
  // non-UTC servers.
  cron.schedule(CLEANUP_CRON_EXPRESSION, executeCleanup, {
    runOnInit: false,
    timezone: CLEANUP_TIMEZONE,
  });
}

/**
 * Get cleanup job status
 */
export function getCleanupStatus() {
  return {
    isRunning,
    lastRunTime
  };
}
