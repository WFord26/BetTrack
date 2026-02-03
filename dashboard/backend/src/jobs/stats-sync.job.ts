import cron from 'node-cron';
import { StatsSyncService } from '../services/stats-sync.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

const statsSyncService = new StatsSyncService();

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: any = null;

async function syncLiveStats() {
  if (isRunning) {
    logger.debug('Stats sync already running, skipping');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  try {
    logger.info('Starting live stats sync...');
    const result = await statsSyncService.syncAllLiveStats();
    
    lastResult = result;
    
    if (result.errors.length > 0) {
      logger.warn(`Stats sync completed with errors: ${result.errors.length} errors`);
    } else {
      logger.info(`Stats sync successful: ${result.gamesUpdated} games updated`);
    }
  } catch (error) {
    logger.error('Stats sync job failed:', error);
  } finally {
    isRunning = false;
  }
}

export function startStatsSyncJob() {
  // Only start if API_SPORTS_KEY is configured
  if (!env.API_SPORTS_KEY) {
    logger.warn('API_SPORTS_KEY not configured, stats sync job disabled');
    return null;
  }

  const pollInterval = parseInt(env.STATS_POLL_INTERVAL_MS || '15000', 10);
  const pollSeconds = Math.floor(pollInterval / 1000);

  // For polling intervals less than 60 seconds, use seconds-based cron
  if (pollSeconds < 60) {
    const cronExpression = `*/${pollSeconds} * * * * *`;
    
    const task = cron.schedule(cronExpression, async () => {
      const hour = new Date().getHours();
      // Only run frequent polling during typical game hours (10 AM - 2 AM ET)
      if (hour >= 10 || hour < 2) {
        await syncLiveStats();
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York',
    });

    logger.info(`Stats sync job started (every ${pollSeconds}s during game hours)`);
    
    // Run immediately on startup
    syncLiveStats();
    
    return task;
  } else {
    // For longer intervals, use minute-based cron
    const pollMinutes = Math.floor(pollSeconds / 60);
    const cronExpression = `*/${pollMinutes} * * * *`;
    
    const task = cron.schedule(cronExpression, syncLiveStats, {
      scheduled: true,
      timezone: 'America/New_York',
    });

    logger.info(`Stats sync job started (every ${pollMinutes} minutes)`);
    
    // Run immediately on startup
    syncLiveStats();
    
    return task;
  }
}

export function getStatsSyncStatus() {
  return {
    isRunning,
    lastRunTime,
    lastResult,
  };
}
