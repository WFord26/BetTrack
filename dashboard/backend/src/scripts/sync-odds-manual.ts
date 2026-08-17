/**
 * Script to manually trigger odds sync
 * 
 * Usage: tsx src/scripts/sync-odds-manual.ts [sportKey]
 * 
 * Examples:
 *   tsx src/scripts/sync-odds-manual.ts              # Sync all sports
 *   tsx src/scripts/sync-odds-manual.ts basketball_nba  # Sync NBA only
 */

import { oddsSyncService } from '../services/odds-sync.service';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import type { SyncResult } from '../types/odds-api.types';

function logSyncResults(result: SyncResult) {
  logger.info('=== Sync Results ===');
  logger.info(`Success: ${result.success}`);
  logger.info(`Games Processed: ${result.gamesProcessed}`);
  logger.info(`Odds Processed: ${result.oddsProcessed}`);
  logger.info(`Snapshots Created: ${result.snapshotsCreated}`);
  logger.info(`Errors: ${result.errors.length}`);

  if (result.requestsRemaining !== undefined) {
    logger.info(`API Requests Remaining: ${result.requestsRemaining}`);
  }

  result.errors.forEach((error, idx) => {
    logger.error(`Sync error ${idx + 1}: ${error}`);
  });
}

async function main() {
  const sportKey = process.argv[2];

  try {
    if (sportKey) {
      logger.info(`Manually syncing odds for ${sportKey}...`);
      logSyncResults(await oddsSyncService.syncSportOdds(sportKey));
    } else {
      logger.info('Manually syncing odds for all sports...');
      logSyncResults(await oddsSyncService.syncAllOdds());
    }

  } catch (error) {
    logger.error('Failed to sync odds:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
