/**
 * Script to manually trigger outcome resolution
 * 
 * Usage: tsx src/scripts/resolve-outcomes-manual.ts
 */

import { outcomeResolverService } from '../services/outcome-resolver.service';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

async function main() {
  try {
    logger.info('Manually resolving outcomes...');
    const result = await outcomeResolverService.resolveOutcomes();
    
    console.log('\n=== Resolution Results ===');
    console.log(`Success: ${result.success}`);
    console.log(`Games Checked: ${result.gamesChecked}`);
    console.log(`Games Updated: ${result.gamesUpdated}`);
    console.log(`Legs Settled: ${result.legsSettled}`);
    console.log(`Bets Settled: ${result.betsSettled}`);
    console.log(`Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error}`);
      });
    }

  } catch (error) {
    logger.error('Failed to resolve outcomes:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
