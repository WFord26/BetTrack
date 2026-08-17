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
    
    logger.info('=== Resolution Results ===');
    logger.info(`Success: ${result.success}`);
    logger.info(`Games Checked: ${result.gamesChecked}`);
    logger.info(`Games Updated: ${result.gamesUpdated}`);
    logger.info(`Legs Settled: ${result.legsSettled}`);
    logger.info(`Bets Settled: ${result.betsSettled}`);
    logger.info(`Errors: ${result.errors.length}`);

    result.errors.forEach((error, idx) => {
      logger.error(`Resolution error ${idx + 1}: ${error}`);
    });

  } catch (error) {
    logger.error('Failed to resolve outcomes:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
