import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { oddsSyncService } from '../services/odds-sync.service';
import { futuresSyncService } from '../services/futures-sync.service';
import { outcomeResolverService } from '../services/outcome-resolver.service';
import { getOddsSyncStatus } from '../jobs/sync-odds.job';

const router = Router();

// Sports data for initialization
const SPORTS = [
  { key: 'americanfootball_nfl', name: 'NFL', groupName: 'American Football', isActive: true },
  { key: 'basketball_nba', name: 'NBA', groupName: 'Basketball', isActive: true },
  { key: 'basketball_ncaab', name: 'NCAAB', groupName: 'Basketball', isActive: true },
  { key: 'icehockey_nhl', name: 'NHL', groupName: 'Ice Hockey', isActive: true },
  { key: 'baseball_mlb', name: 'MLB', groupName: 'Baseball', isActive: true },
  { key: 'soccer_epl', name: 'EPL', groupName: 'Soccer', isActive: false },
  { key: 'soccer_uefa_champs_league', name: 'UEFA Champions League', groupName: 'Soccer', isActive: false },
];

/**
 * POST /api/admin/init-sports
 * Initialize sports data in database
 */
router.post('/init-sports', async (_req: Request, res: Response) => {
  try {
    logger.info('Initializing sports in database via API...');

    const results: any[] = [];
    for (const sport of SPORTS) {
      const result = await prisma.sport.upsert({
        where: { key: sport.key },
        update: {
          name: sport.name,
          groupName: sport.groupName,
          isActive: sport.isActive
        },
        create: sport
      });
      results.push(result);
    }

    logger.info(`Initialized ${results.length} sports`);

    res.json({
      status: 'success',
      message: `Initialized ${results.length} sports`,
      data: results
    });
  } catch (error: any) {
    logger.error('Failed to initialize sports:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initialize sports',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/sync-odds
 * Manually trigger odds synchronization
 */
router.post('/sync-odds', async (req: Request, res: Response) => {
  try {
    const { sportKey } = req.body;

    logger.info('Manually triggering odds sync...', { sportKey });

    // Run sync in background
    const syncPromise = sportKey 
      ? oddsSyncService.syncSportOdds(sportKey)
      : oddsSyncService.syncAllOdds();

    // Don't await - return immediately and let sync run
    syncPromise.catch(error => {
      logger.error('Background odds sync failed:', error);
    });

    res.json({
      status: 'success',
      message: 'Odds sync started in background',
      data: { sportKey: sportKey || 'all' }
    });
  } catch (error: any) {
    logger.error('Failed to start odds sync:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start odds sync',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/resolve-outcomes
 * Manually trigger bet outcome resolution
 */
router.post('/resolve-outcomes', async (_req: Request, res: Response) => {
  try {
    logger.info('Manually triggering outcome resolution...');

    // Run resolution in background
    const resolvePromise = outcomeResolverService.resolveOutcomes();

    resolvePromise.catch(error => {
      logger.error('Background outcome resolution failed:', error);
    });

    res.json({
      status: 'success',
      message: 'Outcome resolution started in background'
    });
  } catch (error: any) {
    logger.error('Failed to start outcome resolution:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start outcome resolution',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/sync-futures
 * Manually trigger futures odds sync
 */
router.post('/sync-futures', async (req: Request, res: Response) => {
  try {
    const { sportKey } = req.body;
    
    logger.info(sportKey ? `Manually triggering futures sync for ${sportKey}...` : 'Manually triggering futures sync for all sports...');

    // Run sync in background
    const syncPromise = sportKey 
      ? futuresSyncService.syncSportFutures(sportKey)
      : futuresSyncService.syncAllFutures();

    syncPromise.catch(error => {
      logger.error('Background futures sync failed:', error);
    });

    res.json({
      status: 'success',
      message: 'Futures sync started in background',
      data: { sportKey: sportKey || 'all' }
    });
  } catch (error: any) {
    logger.error('Failed to start futures sync:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start futures sync',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/stats
 * Get database statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [
      sportsCount,
      teamsCount,
      gamesCount,
      currentOddsCount,
      oddsSnapshotsCount,
      betsCount,
      betLegsCount
    ] = await Promise.all([
      prisma.sport.count(),
      prisma.team.count(),
      prisma.game.count(),
      prisma.currentOdds.count(),
      prisma.oddsSnapshot.count(),
      prisma.bet.count(),
      prisma.betLeg.count()
    ]);

    const activeSports = await prisma.sport.findMany({
      where: { isActive: true },
      select: { key: true, name: true }
    });

    const recentGames = await prisma.game.count({
      where: {
        commenceTime: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    });

    res.json({
      status: 'success',
      data: {
        database: {
          sports: sportsCount,
          teams: teamsCount,
          games: gamesCount,
          currentOdds: currentOddsCount,
          oddsSnapshots: oddsSnapshotsCount,
          bets: betsCount,
          betLegs: betLegsCount
        },
        activeSports,
        recentGames
      }
    });
  } catch (error: any) {
    logger.error('Failed to get admin stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get stats',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/health
 * Detailed health check with database connectivity
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    const sportsCount = await prisma.sport.count();
    const gamesCount = await prisma.game.count();

    // Get sync job status for API requests remaining
    const syncStatus = getOddsSyncStatus();
    const requestsRemaining = syncStatus.lastResult?.requestsRemaining;

    res.json({
      status: 'success',
      data: {
        database: 'connected',
        dataInitialized: sportsCount > 0,
        hasGames: gamesCount > 0,
        timestamp: new Date().toISOString(),
        apiRequestsRemaining: requestsRemaining
      }
    });
  } catch (error: any) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Service unhealthy',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/site-config
 * Get site configuration (logo, name, domain)
 */
router.get('/site-config', async (_req: Request, res: Response) => {
  try {
    let config = await prisma.siteConfig.findUnique({
      where: { id: 1 }
    });

    // Create default config if it doesn't exist
    if (!config) {
      config = await prisma.siteConfig.create({
        data: {
          id: 1,
          siteName: 'Sports Betting',
          logoUrl: null,
          domainUrl: null
        }
      });
    }

    res.json({
      status: 'success',
      data: config
    });
  } catch (error: any) {
    logger.error('Failed to get site config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get site configuration',
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/site-config
 * Update site configuration
 */
router.put('/site-config', async (req: Request, res: Response) => {
  try {
    const { siteName, logoUrl, domainUrl } = req.body;

    // Validate inputs
    if (siteName && siteName.length > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'Site name must be 100 characters or less'
      });
    }

    if (logoUrl && logoUrl.length > 500) {
      return res.status(400).json({
        status: 'error',
        message: 'Logo URL must be 500 characters or less'
      });
    }

    if (domainUrl && domainUrl.length > 255) {
      return res.status(400).json({
        status: 'error',
        message: 'Domain URL must be 255 characters or less'
      });
    }

    const config = await prisma.siteConfig.upsert({
      where: { id: 1 },
      update: {
        ...(siteName !== undefined && { siteName }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        ...(domainUrl !== undefined && { domainUrl: domainUrl || null })
      },
      create: {
        id: 1,
        siteName: siteName || 'Sports Betting',
        logoUrl: logoUrl || null,
        domainUrl: domainUrl || null
      }
    });

    logger.info('Site configuration updated', { config });

    res.json({
      status: 'success',
      message: 'Site configuration updated successfully',
      data: config
    });
  } catch (error: any) {
    logger.error('Failed to update site config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update site configuration',
      error: error.message
    });
  }
});

export default router;
