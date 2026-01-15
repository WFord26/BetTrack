/**
 * Script to initialize sports in the database
 * 
 * Usage: tsx src/scripts/init-sports.ts
 */

import { prisma } from '../config/database';
import { logger } from '../config/logger';

const SPORTS = [
  { key: 'americanfootball_nfl', name: 'NFL', groupName: 'American Football', isActive: true },
  { key: 'americanfootball_ncaaf', name: 'NCAAF', groupName: 'American Football', isActive: true },
  { key: 'basketball_nba', name: 'NBA', groupName: 'Basketball', isActive: true },
  { key: 'basketball_ncaab', name: 'NCAAB', groupName: 'Basketball', isActive: true },
  { key: 'icehockey_nhl', name: 'NHL', groupName: 'Ice Hockey', isActive: true },
  { key: 'baseball_mlb', name: 'MLB', groupName: 'Baseball', isActive: true },
  { key: 'soccer_epl', name: 'EPL', groupName: 'Soccer', isActive: false },
  { key: 'soccer_uefa_champs_league', name: 'UEFA Champions League', groupName: 'Soccer', isActive: false },
];

async function main() {
  logger.info('Initializing sports in database...');

  try {
    for (const sport of SPORTS) {
      await prisma.sport.upsert({
        where: { key: sport.key },
        update: {
          name: sport.name,
          groupName: sport.groupName,
          isActive: sport.isActive
        },
        create: sport
      });
      
      logger.info(`✅ ${sport.name} (${sport.key})`);
    }

    const count = await prisma.sport.count();
    logger.info(`\nTotal sports in database: ${count}`);
    
    const activeCount = await prisma.sport.count({ where: { isActive: true } });
    logger.info(`Active sports: ${activeCount}`);

  } catch (error) {
    logger.error('Failed to initialize sports:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
