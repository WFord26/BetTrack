import cron, { ScheduledTask } from 'node-cron';
import { arbitrageService, ScanResult } from '../services/arbitrage.service';
import { onOddsSyncCompleted } from '../events/odds-sync.events';
import { logger } from '../config/logger';
import { env } from '../config/env';

/**
 * Arbitrage scanning job.
 *
 * Two triggers, because the useful work and the housekeeping run on very
 * different clocks:
 *
 *   1. Event driven — a full scan fires as soon as `sync-odds.job` finishes,
 *      which is the only moment `CurrentOdds` actually changes. This is what
 *      makes an opportunity surface within one cycle of the data arriving.
 *   2. Safety cron (default every 30 seconds) — expires opportunities that
 *      have passed their TTL and re-scans if a sync notification was missed
 *      (process restart, crashed sync, manual odds import).
 *
 * The cron pass skips the full scan when the odds snapshot has not changed
 * since the last one, so the 30 second cadence costs an expiry UPDATE rather
 * than a full sweep of every upcoming game.
 */

const SCAN_CRON = env.ARBITRAGE_SCAN_CRON || '*/30 * * * * *';
const SCAN_ENABLED = env.ARBITRAGE_SCAN_ENABLED !== 'false';

/** Force a full scan on the cron pass if none has run in this long. */
const MAX_SCAN_GAP_MS = 5 * 60 * 1000;

let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: ScanResult | null = null;
let lastTrigger: 'odds-sync' | 'cron' | 'startup' | 'manual' | null = null;
let pendingOddsSync = false;
let unsubscribe: (() => void) | null = null;

export async function executeArbitrageScan(
  trigger: 'odds-sync' | 'cron' | 'startup' | 'manual' = 'manual'
): Promise<ScanResult | null> {
  if (isRunning) {
    logger.warn('Arbitrage scan already in progress, skipping...');
    return null;
  }

  isRunning = true;
  lastRunTime = new Date();
  lastTrigger = trigger;

  try {
    const result = await arbitrageService.scanForArbitrage();
    lastResult = result;

    if (result.opportunitiesFound > 0 || result.expired > 0) {
      logger.info(
        `🔍 Arbitrage scan (${trigger}): ${result.gamesScanned} games, ` +
          `${result.opportunitiesFound} opportunities ` +
          `(${result.opportunitiesCreated} new, ${result.opportunitiesRefreshed} refreshed), ` +
          `${result.expired} expired, ${result.durationMs}ms`
      );
    } else {
      logger.debug(
        `Arbitrage scan (${trigger}): no opportunities across ${result.gamesScanned} games ` +
          `in ${result.durationMs}ms`
      );
    }

    result.errors.forEach((error, idx) => logger.warn(`   arb error ${idx + 1}: ${error}`));

    return result;
  } catch (error) {
    logger.error('Fatal error during arbitrage scan:', error);
    return null;
  } finally {
    isRunning = false;
  }
}

/**
 * Cron pass. Always expires stale rows; only re-scans when new odds arrived
 * or the last full scan is older than MAX_SCAN_GAP_MS.
 */
async function cronPass() {
  const staleGap = !lastRunTime || Date.now() - lastRunTime.getTime() > MAX_SCAN_GAP_MS;

  if (pendingOddsSync || staleGap) {
    pendingOddsSync = false;
    await executeArbitrageScan('cron');
    return;
  }

  try {
    const expired = await arbitrageService.expireStaleOpportunities();
    if (expired > 0) {
      logger.debug(`Arbitrage housekeeping: expired ${expired} opportunit(ies)`);
    }
  } catch (error) {
    logger.error('Error expiring stale arbitrage opportunities:', error);
  }
}

export function startArbitrageScanJob() {
  if (!SCAN_ENABLED) {
    logger.info('⏭️  Arbitrage scan job disabled (ARBITRAGE_SCAN_ENABLED=false)');
    return null;
  }

  logger.info(`📅 Scheduling arbitrage scan job: ${SCAN_CRON} (plus odds-sync triggered scans)`);

  unsubscribe = onOddsSyncCompleted((payload) => {
    if (!payload.success) {
      // A failed sync left the snapshot unchanged; let the cron handle expiry.
      pendingOddsSync = true;
      return;
    }
    void executeArbitrageScan('odds-sync');
  });

  const task = cron.schedule(SCAN_CRON, cronPass, {
    timezone: 'America/New_York',
  });

  logger.info('Running initial arbitrage scan...');
  void executeArbitrageScan('startup');

  return task;
}

export function stopArbitrageScanJob(task: ScheduledTask | null) {
  logger.info('Stopping arbitrage scan job...');
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  task?.stop();
}

export function getArbitrageScanJobStatus() {
  return {
    enabled: SCAN_ENABLED,
    isRunning,
    lastRunTime,
    lastTrigger,
    lastResult,
    cronExpression: SCAN_CRON,
  };
}
