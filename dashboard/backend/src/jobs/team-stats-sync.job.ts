import cron from 'node-cron';
import { StatsSyncService, TeamStatsSyncResult } from '../services/stats-sync.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

const statsSyncService = new StatsSyncService();

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResults: TeamStatsSyncResult[] | null = null;

/** The pinned season from the environment, or undefined for "in progress". */
function configuredSeason(): number | undefined {
  const season = parseInt(env.TEAM_STATS_SYNC_SEASON || '', 10);
  return Number.isNaN(season) ? undefined : season;
}

async function executeTeamStatsSync() {
  if (isRunning) {
    logger.warn('Team season stats sync already in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  const minimumRemainingRequests = parseInt(env.API_SPORTS_MIN_REMAINING, 10) || 500;
  const delayMs = parseInt(env.TEAM_STATS_SYNC_DELAY_MS, 10) || 250;

  try {
    logger.info('='.repeat(60));
    logger.info('Starting daily team season stats sync...');

    const startTime = Date.now();
    const results = await statsSyncService.syncAllTeamSeasonStats({
      season: configuredSeason(),
      minimumRemainingRequests,
      delayMs,
    });
    const duration = Date.now() - startTime;

    lastResults = results;

    const teamsUpdated = results.reduce((sum, result) => sum + result.teamsUpdated, 0);
    const errors = results.flatMap(result => result.errors);

    logger.info(`Team season stats sync finished in ${duration}ms`);
    for (const result of results) {
      logger.info(
        `   ${result.sportKey} (season ${result.season}): ${result.teamsUpdated}/${result.teamsProcessed} updated, ${result.teamsSkipped} skipped`
      );
    }
    logger.info(`   Teams Updated: ${teamsUpdated}`);

    if (results.some(result => result.pausedDueToQuota)) {
      logger.warn('   Sync paused early for at least one sport due to quota floor');
    }

    if (errors.length > 0) {
      logger.error(`Team season stats sync reported ${errors.length} errors`);
      errors.slice(0, 10).forEach((error, idx) => {
        logger.error(`   ${idx + 1}. ${error}`);
      });
    }

    logger.info('='.repeat(60));
  } catch (error) {
    logger.error('Fatal error during team season stats sync:', error);
  } finally {
    isRunning = false;
  }
}

export function startTeamStatsSyncJob() {
  if (!env.API_SPORTS_KEY) {
    logger.warn('API_SPORTS_KEY not configured, team season stats sync job disabled');
    return null;
  }

  logger.info(`📅 Scheduling team season stats sync job: ${env.TEAM_STATS_SYNC_CRON}`);

  // Deliberately no run on startup: a full pass costs one request per team
  // across every sport, so a restart loop would burn the daily quota. The
  // admin route is there when an operator wants one immediately.
  return cron.schedule(env.TEAM_STATS_SYNC_CRON, executeTeamStatsSync, {
    timezone: 'America/New_York',
  });
}

export function getTeamStatsSyncStatus() {
  return {
    isRunning,
    lastRunTime,
    lastResults,
    cronExpression: env.TEAM_STATS_SYNC_CRON,
  };
}
