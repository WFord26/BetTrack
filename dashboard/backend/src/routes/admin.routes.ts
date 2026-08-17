import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, Sport } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { oddsSyncService } from '../services/odds-sync.service';
import { futuresSyncService } from '../services/futures-sync.service';
import { outcomeResolverService } from '../services/outcome-resolver.service';
import { StatsSyncService } from '../services/stats-sync.service';
import { getOddsSyncStatus } from '../jobs/sync-odds.job';
import { getMlbHourlySyncStatus } from '../jobs/mlb-hourly-sync.job';
import { getFootballHourlySyncStatus } from '../jobs/football-hourly-sync.job';
import { env } from '../config/env';
import { requireAdminAccess } from '../middleware/session.auth';
import { validateBody } from '../middleware/validation.middleware';
import { getErrorMessage } from '../utils/error-message';

const router = Router();
const statsSyncService = new StatsSyncService();

type SyncRunStatus = 'idle' | 'running' | 'completed' | 'failed';

interface MlbSyncUiState {
  status: SyncRunStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  summary: {
    datesProcessed: number;
    datesSkipped: number;
    gamesProcessed: number;
    gamesUpdated: number;
    requestsRemaining?: number;
    pausedDueToQuota: boolean;
    errors: number;
  } | null;
  error: string | null;
}

const initialMlbUiState: MlbSyncUiState = {
  status: 'idle',
  startedAt: null,
  endedAt: null,
  durationMs: null,
  summary: null,
  error: null,
};

let mlbSeedUiState: MlbSyncUiState = { ...initialMlbUiState };
let mlbManualWindowUiState: MlbSyncUiState = { ...initialMlbUiState };

// Football (NFL/NCAAF) sync UI state shares the same shape as MLB's.
type FootballSyncUiState = MlbSyncUiState;
const initialFootballUiState: FootballSyncUiState = { ...initialMlbUiState };
let footballManualWindowUiState: FootballSyncUiState = { ...initialFootballUiState };

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const siteConfigSchema = z.object({
  siteName: z.string().max(100, 'Site name must be 100 characters or less').optional(),
  logoUrl: z.union([
    z.string().url('Logo URL must be a valid URL').max(500, 'Logo URL must be 500 characters or less'),
    z.literal(''),
    z.null()
  ]).optional(),
  domainUrl: z.union([
    z.string().url('Domain URL must be a valid URL').max(255, 'Domain URL must be 255 characters or less'),
    z.literal(''),
    z.null()
  ]).optional()
});

// Sports data for initialization
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

router.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/site-config' || req.path === '/health')) {
    return next();
  }

  return requireAdminAccess(req, res, next);
});

/**
 * POST /api/admin/init-sports
 * Initialize sports data in database
 */
router.post('/init-sports', async (_req: Request, res: Response) => {
  try {
    logger.info('Initializing sports in database via API...');

    const results: Sport[] = [];
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
  } catch (error) {
    logger.error('Failed to initialize sports:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initialize sports',
      error: getErrorMessage(error)
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
  } catch (error) {
    logger.error('Failed to start odds sync:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start odds sync',
      error: getErrorMessage(error)
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
  } catch (error) {
    logger.error('Failed to start outcome resolution:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start outcome resolution',
      error: getErrorMessage(error)
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
  } catch (error) {
    logger.error('Failed to start futures sync:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start futures sync',
      error: getErrorMessage(error)
    });
  }
});

/**
 * POST /api/admin/sync-teams
 * Sync team rosters from API-Sports for all sports (NFL, NBA, NHL, NCAAB).
 * Runs in the background — responds immediately.
 */
router.post('/sync-teams', async (_req: Request, res: Response) => {
  try {
    logger.info('Manually triggering team sync for all sports...');

    statsSyncService.syncAllTeams().then((results) => {
      const total = Object.values(results).reduce((sum, n) => sum + n, 0);
      logger.info(`Background team sync complete: ${total} teams synced`, results);
    }).catch(error => {
      logger.error('Background team sync failed:', error);
    });

    res.json({
      status: 'success',
      message: 'Team sync started in background. Check logs for progress.',
    });
  } catch (error) {
    logger.error('Failed to start team sync:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start team sync',
      error: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/admin/seed-mlb-stats
 * Seed MLB season-to-date game/stat data from API-Sports into local DB.
 * Runs in the background — responds immediately.
 */
router.post('/seed-mlb-stats', async (_req: Request, res: Response) => {
  try {
    const minimumRemainingRequests = parseInt(process.env.API_SPORTS_MIN_REMAINING || '500', 10);
    const startedAt = new Date();

    logger.info('Manually triggering MLB season-to-date seed...');

    mlbSeedUiState = {
      ...initialMlbUiState,
      status: 'running',
      startedAt: startedAt.toISOString(),
    };

    statsSyncService.seedMlbSeasonToDate({ minimumRemainingRequests }).then((result) => {
      const endedAt = new Date();

      mlbSeedUiState = {
        status: result.errors.length > 0 ? 'failed' : 'completed',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        summary: {
          datesProcessed: result.datesProcessed,
          datesSkipped: result.datesSkipped,
          gamesProcessed: result.gamesProcessed,
          gamesUpdated: result.gamesUpdated,
          requestsRemaining: result.requestsRemaining,
          pausedDueToQuota: result.pausedDueToQuota,
          errors: result.errors.length,
        },
        error: result.errors.length > 0 ? result.errors[0] : null,
      };

      logger.info('Background MLB seed complete', result);
    }).catch(error => {
      const endedAt = new Date();
      mlbSeedUiState = {
        status: 'failed',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        summary: null,
        error: String(error),
      };
      logger.error('Background MLB seed failed:', error);
    });

    res.json({
      status: 'success',
      message: 'MLB season seed started in background. Check logs for progress.',
      data: {
        minimumRemainingRequests,
      },
    });
  } catch (error) {
    logger.error('Failed to start MLB season seed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start MLB season seed',
      error: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/admin/sync-mlb-hourly-window
 * Run the MLB incremental window sync immediately (recent + near future).
 * Runs in the background — responds immediately.
 */
router.post('/sync-mlb-hourly-window', async (_req: Request, res: Response) => {
  try {
    const minimumRemainingRequests = parseInt(process.env.API_SPORTS_MIN_REMAINING || '500', 10);
    const hoursBack = parseInt(process.env.MLB_SYNC_HOURS_BACK || '48', 10);
    const hoursForward = parseInt(process.env.MLB_SYNC_HOURS_FORWARD || '24', 10);
    const startedAt = new Date();

    logger.info('Manually triggering MLB hourly window sync...');

    mlbManualWindowUiState = {
      ...initialMlbUiState,
      status: 'running',
      startedAt: startedAt.toISOString(),
    };

    statsSyncService.syncMlbHourlyWindow({
      minimumRemainingRequests,
      hoursBack,
      hoursForward,
    }).then((result) => {
      const endedAt = new Date();

      mlbManualWindowUiState = {
        status: result.errors.length > 0 ? 'failed' : 'completed',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        summary: {
          datesProcessed: result.datesProcessed,
          datesSkipped: result.datesSkipped,
          gamesProcessed: result.gamesProcessed,
          gamesUpdated: result.gamesUpdated,
          requestsRemaining: result.requestsRemaining,
          pausedDueToQuota: result.pausedDueToQuota,
          errors: result.errors.length,
        },
        error: result.errors.length > 0 ? result.errors[0] : null,
      };

      logger.info('Background MLB hourly window sync complete', result);
    }).catch(error => {
      const endedAt = new Date();
      mlbManualWindowUiState = {
        status: 'failed',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        summary: null,
        error: String(error),
      };
      logger.error('Background MLB hourly window sync failed:', error);
    });

    res.json({
      status: 'success',
      message: 'MLB hourly window sync started in background. Check logs for progress.',
      data: {
        minimumRemainingRequests,
        hoursBack,
        hoursForward,
      },
    });
  } catch (error) {
    logger.error('Failed to start MLB hourly window sync:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start MLB hourly window sync',
      error: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/admin/mlb-sync-status
 * Lightweight sync status object for UI polling.
 */
router.get('/mlb-sync-status', async (_req: Request, res: Response) => {
  try {
    const hourlyStatus = getMlbHourlySyncStatus();
    const hourlyLastRun = hourlyStatus.lastRunTime instanceof Date
      ? hourlyStatus.lastRunTime.toISOString()
      : null;
    const hourlySummary = hourlyStatus.lastResult
      ? {
          datesProcessed: hourlyStatus.lastResult.datesProcessed ?? 0,
          datesSkipped: hourlyStatus.lastResult.datesSkipped ?? 0,
          gamesProcessed: hourlyStatus.lastResult.gamesProcessed ?? 0,
          gamesUpdated: hourlyStatus.lastResult.gamesUpdated ?? 0,
          requestsRemaining: hourlyStatus.lastResult.requestsRemaining,
          pausedDueToQuota: !!hourlyStatus.lastResult.pausedDueToQuota,
          errors: Array.isArray(hourlyStatus.lastResult.errors) ? hourlyStatus.lastResult.errors.length : 0,
        }
      : null;

    res.json({
      status: 'success',
      data: {
        seed: mlbSeedUiState,
        manualWindow: mlbManualWindowUiState,
        hourlyJob: {
          status: hourlyStatus.isRunning ? 'running' : 'idle',
          cronExpression: hourlyStatus.cronExpression,
          lastRunTime: hourlyLastRun,
          summary: hourlySummary,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get MLB sync status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get MLB sync status',
      error: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/admin/sync-football-hourly-window
 * Run the football (NFL/NCAAF) incremental window sync immediately.
 * Runs in the background — responds immediately.
 */
router.post('/sync-football-hourly-window', async (_req: Request, res: Response) => {
  try {
    const minimumRemainingRequests = parseInt(env.API_SPORTS_MIN_REMAINING, 10) || 500;
    const hoursBack = parseInt(env.FOOTBALL_SYNC_HOURS_BACK, 10) || 96;
    const hoursForward = parseInt(env.FOOTBALL_SYNC_HOURS_FORWARD, 10) || 72;
    const startedAt = new Date();

    logger.info('Manually triggering football hourly window sync...');

    footballManualWindowUiState = {
      ...initialFootballUiState,
      status: 'running',
      startedAt: startedAt.toISOString(),
    };

    statsSyncService.syncFootballHourlyWindow({
      minimumRemainingRequests,
      hoursBack,
      hoursForward,
    }).then((result) => {
      const endedAt = new Date();

      footballManualWindowUiState = {
        status: result.errors.length > 0 ? 'failed' : 'completed',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        summary: {
          datesProcessed: result.datesProcessed,
          datesSkipped: result.datesSkipped,
          gamesProcessed: result.gamesProcessed,
          gamesUpdated: result.gamesUpdated,
          requestsRemaining: result.requestsRemaining,
          pausedDueToQuota: result.pausedDueToQuota,
          errors: result.errors.length,
        },
        error: result.errors.length > 0 ? result.errors[0] : null,
      };

      logger.info('Background football hourly window sync complete', result);
    }).catch(error => {
      const endedAt = new Date();
      footballManualWindowUiState = {
        status: 'failed',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        summary: null,
        error: String(error),
      };
      logger.error('Background football hourly window sync failed:', error);
    });

    res.json({
      status: 'success',
      message: 'Football hourly window sync started in background. Check logs for progress.',
      data: {
        minimumRemainingRequests,
        hoursBack,
        hoursForward,
      },
    });
  } catch (error) {
    logger.error('Failed to start football hourly window sync:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start football hourly window sync',
      error: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/admin/football-sync-status
 * Lightweight sync status object for UI polling.
 */
router.get('/football-sync-status', async (_req: Request, res: Response) => {
  try {
    const hourlyStatus = getFootballHourlySyncStatus();
    const hourlyLastRun = hourlyStatus.lastRunTime instanceof Date
      ? hourlyStatus.lastRunTime.toISOString()
      : null;
    const hourlySummary = hourlyStatus.lastResult
      ? {
          datesProcessed: hourlyStatus.lastResult.datesProcessed ?? 0,
          datesSkipped: hourlyStatus.lastResult.datesSkipped ?? 0,
          gamesProcessed: hourlyStatus.lastResult.gamesProcessed ?? 0,
          gamesUpdated: hourlyStatus.lastResult.gamesUpdated ?? 0,
          requestsRemaining: hourlyStatus.lastResult.requestsRemaining,
          pausedDueToQuota: !!hourlyStatus.lastResult.pausedDueToQuota,
          errors: Array.isArray(hourlyStatus.lastResult.errors) ? hourlyStatus.lastResult.errors.length : 0,
        }
      : null;

    res.json({
      status: 'success',
      data: {
        manualWindow: footballManualWindowUiState,
        hourlyJob: {
          status: hourlyStatus.isRunning ? 'running' : 'idle',
          cronExpression: hourlyStatus.cronExpression,
          lastRunTime: hourlyLastRun,
          summary: hourlySummary,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get football sync status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get football sync status',
      error: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/admin/sports
 * Get all sports with their active status
 */
router.get('/sports', async (_req: Request, res: Response) => {
  try {
    const sports = await prisma.sport.findMany({
      orderBy: [
        { groupName: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        key: true,
        name: true,
        groupName: true,
        isActive: true,
        _count: {
          select: {
            games: true,
            teams: true
          }
        }
      }
    });

    res.json({
      status: 'success',
      data: sports
    });
  } catch (error) {
    logger.error('Failed to get sports:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get sports',
      error: getErrorMessage(error)
    });
  }
});

/**
 * PATCH /api/admin/sports/:sportKey
 * Update sport active status
 */
router.patch('/sports/:sportKey', async (req: Request, res: Response) => {
  try {
    const { sportKey } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'isActive must be a boolean value'
      });
    }

    const sport = await prisma.sport.update({
      where: { key: sportKey },
      data: { isActive },
      select: {
        id: true,
        key: true,
        name: true,
        groupName: true,
        isActive: true
      }
    });

    logger.info(`Sport ${sport.name} (${sport.key}) ${isActive ? 'activated' : 'deactivated'}`);

    res.json({
      status: 'success',
      message: `Sport ${sport.name} ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: sport
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({
        status: 'error',
        message: 'Sport not found'
      });
    }

    logger.error('Failed to update sport:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update sport',
      error: getErrorMessage(error)
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
  } catch (error) {
    logger.error('Failed to get admin stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get stats',
      error: getErrorMessage(error)
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

    // Read version from package.json at runtime
    const { version } = require('../../package.json') as { version: string };

    res.json({
      status: 'success',
      data: {
        version,
        database: 'connected',
        dataInitialized: sportsCount > 0,
        hasGames: gamesCount > 0,
        timestamp: new Date().toISOString(),
        apiRequestsRemaining: requestsRemaining
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Service unhealthy',
      error: getErrorMessage(error)
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
  } catch (error) {
    logger.error('Failed to get site config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get site configuration',
      error: getErrorMessage(error)
    });
  }
});

/**
 * PUT /api/admin/site-config
 * Update site configuration
 */
router.put('/site-config', validateBody(siteConfigSchema), async (req: Request, res: Response) => {
  try {
    const { siteName, logoUrl, domainUrl } = req.body;

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
  } catch (error) {
    logger.error('Failed to update site config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update site configuration',
      error: getErrorMessage(error)
    });
  }
});

const adminSettingsSchema = z.object({
  riskHighThreshold: z.number().positive().optional(),
  riskModerateThreshold: z.number().positive().optional(),
  winRateLow: z.number().min(0).max(100).optional(),
  winRateHigh: z.number().min(0).max(100).optional()
});

/**
 * GET /api/admin/settings
 * Get deployment-wide MCP risk thresholds (creates singleton row with defaults if absent)
 */
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.adminSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' }
    });
    res.json({ status: 'success', data: settings });
  } catch (error) {
    logger.error('Failed to fetch admin settings:', error);
    res.status(500).json({ status: 'error', error: getErrorMessage(error) });
  }
});

/**
 * PATCH /api/admin/settings
 * Update deployment-wide MCP risk thresholds
 */
router.patch('/settings', validateBody(adminSettingsSchema), async (req: Request, res: Response) => {
  try {
    const settings = await prisma.adminSettings.upsert({
      where: { id: 'singleton' },
      update: req.body,
      create: { id: 'singleton', ...req.body }
    });
    res.json({ status: 'success', data: settings });
  } catch (error) {
    logger.error('Failed to update admin settings:', error);
    res.status(500).json({ status: 'error', error: getErrorMessage(error) });
  }
});

export default router;
