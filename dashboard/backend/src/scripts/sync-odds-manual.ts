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

async function main() {
  const sportKey = process.argv[2];

  try {
    if (sportKey) {
      logger.info(`Manually syncing odds for ${sportKey}...`);
      const result = await oddsSyncService.syncSportOdds(sportKey);
      
      console.log('\n=== Sync Results ===');
      console.log(`Success: ${result.success}`);
      console.log(`Games Processed: ${result.gamesProcessed}`);
      console.log(`Odds Processed: ${result.oddsProcessed}`);
      console.log(`Snapshots Created: ${result.snapshotsCreated}`);
      console.log(`Errors: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach((error, idx) => {
          console.log(`  ${idx + 1}. ${error}`);
        });
      }
    } else {
      logger.info('Manually syncing odds for all sports...');
      const result = await oddsSyncService.syncAllOdds();
      
      console.log('\n=== Sync Results ===');
      console.log(`Success: ${result.success}`);
      console.log(`Games Processed: ${result.gamesProcessed}`);
      console.log(`Odds Processed: ${result.oddsProcessed}`);
      console.log(`Snapshots Created: ${result.snapshotsCreated}`);
      console.log(`Errors: ${result.errors.length}`);
      
      if (result.requestsRemaining !== undefined) {
        console.log(`API Requests Remaining: ${result.requestsRemaining}`);
      }
      
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach((error, idx) => {
          console.log(`  ${idx + 1}. ${error}`);
        });
      }
    }

  } catch (error) {
    logger.error('Failed to sync odds:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
