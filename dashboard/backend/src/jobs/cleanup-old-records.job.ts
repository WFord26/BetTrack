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

const CLEANUP_CRON_EXPRESSION = '0 2 * * *'; // 2 AM UTC daily

let isRunning = false;
let lastRunTime: Date | null = null;

/**
 * Delete old odds snapshots (30-day retention)
 */
async function deleteOldOddsSnapshots() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  try {
    const result = await prisma.oddsSnapshot.deleteMany({
      where: {
        capturedAt: {
          lt: thirtyDaysAgo
        }
      }
    });
    
    logger.info(`📊 Deleted ${result.count} old odds snapshots (older than 30 days)`);
    return result.count;
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
    const result = await prisma.apiKeyUsage.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo
        }
      }
    });
    
    logger.info(`🔐 Deleted ${result.count} old API key usage records (older than 90 days)`);
    return result.count;
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
  logger.info(`Scheduling cleanup job to run at: ${CLEANUP_CRON_EXPRESSION} (2 AM UTC)`);
  cron.schedule(CLEANUP_CRON_EXPRESSION, executeCleanup, {
    runOnInit: false
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
