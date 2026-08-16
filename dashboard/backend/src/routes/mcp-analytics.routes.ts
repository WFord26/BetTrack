import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  arbitrageService,
  buildStakePlan,
  ArbType,
  ArbMarketType,
} from '../services/arbitrage.service';
import { clvService } from '../services/clv.service';
import { sharpIndicatorService } from '../services/sharp-indicator.service';
import { marketConsensusService } from '../services/market-consensus.service';
import { bookmakerAnalyticsService } from '../services/bookmaker-analytics.service';
import { LineMovementService } from '../services/line-movement.service';

/**
 * MCP Analytics Routes
 * ====================
 * API key authenticated mirrors of the session gated `/api/analytics/*`
 * routers. Mounted by `mcp.routes.ts` at `/api/mcp/analytics`, so
 * `apiKeyAuth` has already run by the time any handler here executes.
 *
 * These handlers call the same services as the session routes. They are
 * read only by design: the write endpoints on the session routers
 * (arbitrage take, CLV recalculation) are deliberately not mirrored so an
 * API key with `stats` permission can never mutate state.
 */

const router = Router();

const lineMovementService = new LineMovementService();

const ARB_TYPES: ArbType[] = ['two-way', 'three-way', 'middle'];
const MARKET_TYPES: ArbMarketType[] = ['h2h', 'spreads', 'totals'];
const MOVEMENT_TYPES = ['steam', 'reverse', 'gradual', 'injury'];

// ============================================================================
// HELPERS
// ============================================================================

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function optionalFloat(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Scope analytics to the user who owns the API key.
 *
 * Returns undefined for keys that are not bound to a user, which matches
 * the behaviour of `getScopedUserId` on the session routes when
 * `AUTH_MODE=none` and means "no user filter".
 */
function scopedUserId(req: Request): string | undefined {
  return req.apiKey?.userId ?? undefined;
}

function ok(res: Response, data: unknown) {
  return res.json({ success: true, data });
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

/** Wrap a handler so any thrown error becomes a logged 500 instead of a hang. */
function handle(
  label: string,
  fn: (req: Request, res: Response) => Promise<unknown>
) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      logger.error(`MCP analytics error (${label}):`, error);
      if (!res.headersSent) {
        fail(res, 500, `Failed to fetch ${label}`);
      }
    }
  };
}

// ============================================================================
// ARBITRAGE
// ============================================================================

/**
 * GET /api/mcp/analytics/arbitrage/live
 * Query: limit, minProfit, arbType, marketType, maxSnapshotAge
 */
router.get(
  '/arbitrage/live',
  handle('arbitrage opportunities', async (req, res) => {
    const maxSnapshotAge = optionalFloat(req.query.maxSnapshotAge);

    const opportunities = await arbitrageService.getLiveOpportunities({
      limit: clampInt(req.query.limit, 25, 1, 100),
      minProfit: optionalFloat(req.query.minProfit),
      arbType: ARB_TYPES.includes(req.query.arbType as ArbType)
        ? (req.query.arbType as ArbType)
        : undefined,
      marketType: MARKET_TYPES.includes(req.query.marketType as ArbMarketType)
        ? (req.query.marketType as ArbMarketType)
        : undefined,
      maxSnapshotAge: maxSnapshotAge === undefined ? undefined : Math.round(maxSnapshotAge),
    });

    ok(res, {
      opportunities,
      count: opportunities.length,
      retrievedAt: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/mcp/analytics/arbitrage/history
 * Query: limit, daysBack, status, mine
 */
router.get(
  '/arbitrage/history',
  handle('arbitrage history', async (req, res) => {
    const daysBack = clampInt(req.query.daysBack, 7, 1, 90);

    const opportunities = await arbitrageService.getHistory({
      limit: clampInt(req.query.limit, 50, 1, 200),
      daysBack,
      status: ['active', 'expired', 'taken'].includes(String(req.query.status))
        ? String(req.query.status)
        : undefined,
      userId: req.query.mine === 'true' ? scopedUserId(req) : undefined,
    });

    ok(res, {
      opportunities,
      count: opportunities.length,
      period: `Last ${daysBack} days`,
    });
  })
);

/**
 * GET /api/mcp/analytics/arbitrage/stats
 * Query: daysBack, mine
 */
router.get(
  '/arbitrage/stats',
  handle('arbitrage stats', async (req, res) => {
    const stats = await arbitrageService.getStats({
      daysBack: clampInt(req.query.daysBack, 30, 1, 365),
      userId: req.query.mine === 'true' ? scopedUserId(req) : undefined,
    });

    ok(res, stats);
  })
);

/**
 * POST /api/mcp/analytics/arbitrage/calculator
 * Body: { odds: number[], totalStake: number }
 *
 * Stateless. Included on the MCP surface because it lets Claude size an
 * arbitrage without a round trip through the web UI.
 */
router.post(
  '/arbitrage/calculator',
  handle('arbitrage stake plan', async (req, res) => {
    const { odds, totalStake } = req.body ?? {};

    if (!Array.isArray(odds) || odds.length < 2 || odds.length > 4) {
      return fail(res, 400, 'odds must be an array of 2 to 4 American odds values');
    }

    if (odds.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v === 0)) {
      return fail(res, 400, 'Every entry in odds must be a non zero finite number');
    }

    const stake = typeof totalStake === 'number' ? totalStake : parseFloat(String(totalStake));
    if (!Number.isFinite(stake) || stake <= 0) {
      return fail(res, 400, 'totalStake must be a positive number');
    }

    ok(res, buildStakePlan(odds, stake));
  })
);

/**
 * GET /api/mcp/analytics/arbitrage/:id
 * Declared after the static arbitrage paths so it cannot shadow them.
 */
router.get(
  '/arbitrage/:id',
  handle('arbitrage opportunity', async (req, res) => {
    const opportunity = await arbitrageService.getById(req.params.id);

    if (!opportunity) {
      return fail(res, 404, 'Opportunity not found');
    }

    ok(res, opportunity);
  })
);

// ============================================================================
// CLOSING LINE VALUE
// ============================================================================

function clvFilters(req: Request) {
  const { sportKey, betType, startDate, endDate } = req.query;
  const filters: Record<string, unknown> = {};

  if (sportKey) filters.sportKey = String(sportKey);
  if (betType) filters.betType = String(betType);
  if (startDate) filters.startDate = new Date(String(startDate));
  if (endDate) filters.endDate = new Date(String(endDate));

  return filters;
}

/** GET /api/mcp/analytics/clv/summary */
router.get(
  '/clv/summary',
  handle('CLV summary', async (req, res) => {
    const report = await clvService.generateCLVReport(scopedUserId(req));
    ok(res, report.summary);
  })
);

/** GET /api/mcp/analytics/clv/by-sport */
router.get(
  '/clv/by-sport',
  handle('CLV by sport', async (req, res) => {
    const report = await clvService.generateCLVReport(scopedUserId(req));
    ok(res, report.bySport);
  })
);

/** GET /api/mcp/analytics/clv/by-bookmaker */
router.get(
  '/clv/by-bookmaker',
  handle('CLV by bookmaker', async (req, res) => {
    const report = await clvService.generateCLVReport(scopedUserId(req));
    ok(res, report.byBookmaker);
  })
);

/**
 * GET /api/mcp/analytics/clv/report
 * Query: sportKey, betType, startDate, endDate
 */
router.get(
  '/clv/report',
  handle('CLV report', async (req, res) => {
    const report = await clvService.generateCLVReport(scopedUserId(req), clvFilters(req) as any);
    ok(res, report);
  })
);

// ============================================================================
// SHARP MONEY
// ============================================================================

/**
 * GET /api/mcp/analytics/sharp/live
 * Query: limit
 */
router.get(
  '/sharp/live',
  handle('sharp indicators', async (req, res) => {
    const indicators = await sharpIndicatorService.getLatestIndicators(
      clampInt(req.query.limit, 20, 1, 100)
    );

    ok(res, { indicators, count: indicators.length });
  })
);

/** GET /api/mcp/analytics/sharp/game/:gameId */
router.get(
  '/sharp/game/:gameId',
  handle('game sharp indicators', async (req, res) => {
    const { gameId } = req.params;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        homeTeamName: true,
        awayTeamName: true,
        commenceTime: true,
        status: true,
        sport: { select: { key: true, name: true } },
      },
    });

    if (!game) {
      return fail(res, 404, 'Game not found');
    }

    const indicators = await sharpIndicatorService.getIndicatorsForGame(gameId);

    ok(res, {
      game: {
        id: game.id,
        matchup: `${game.awayTeamName} @ ${game.homeTeamName}`,
        sport: game.sport.name,
        sportKey: game.sport.key,
        commenceTime: game.commenceTime,
        status: game.status,
      },
      indicators,
    });
  })
);

/**
 * GET /api/mcp/analytics/sharp/contrarian
 * Query: minConfidence, limit
 */
router.get(
  '/sharp/contrarian',
  handle('contrarian opportunities', async (req, res) => {
    const minConfidence = clampInt(req.query.minConfidence, 6, 1, 10);
    const opportunities = await sharpIndicatorService.findContrarianOpportunities(
      minConfidence,
      clampInt(req.query.limit, 20, 1, 100)
    );

    ok(res, { opportunities, count: opportunities.length, minConfidence });
  })
);

/**
 * GET /api/mcp/analytics/sharp/stats
 * Query: hoursBack
 */
router.get(
  '/sharp/stats',
  handle('sharp stats', async (req, res) => {
    const hoursBack = clampInt(req.query.hoursBack, 24, 1, 168);
    const stats = await sharpIndicatorService.getStats(hoursBack);

    ok(res, { ...stats, period: `Last ${hoursBack} hours` });
  })
);

// ============================================================================
// LINE MOVEMENT
// ============================================================================

/**
 * GET /api/mcp/analytics/movements/live
 * Query: limit, hoursBack, movementType (steam | reverse | gradual | injury | all)
 */
router.get(
  '/movements/live',
  handle('line movements', async (req, res) => {
    const limit = clampInt(req.query.limit, 20, 1, 200);
    const hoursBack = clampInt(req.query.hoursBack, 4, 1, 168);
    const movementType = String(req.query.movementType ?? 'steam');

    if (movementType !== 'all' && !MOVEMENT_TYPES.includes(movementType)) {
      return fail(
        res,
        400,
        `Invalid movementType. Must be one of: ${MOVEMENT_TYPES.join(', ')}, all`
      );
    }

    const movements =
      movementType === 'all'
        ? await lineMovementService.getRecentMovements(hoursBack)
        : await lineMovementService.getMovementsByType(movementType as any, hoursBack);

    ok(res, {
      movements: movements.slice(0, limit),
      total: movements.length,
      hoursBack,
      movementType,
    });
  })
);

/**
 * GET /api/mcp/analytics/movements/game/:gameId
 * Query: limit
 */
router.get(
  '/movements/game/:gameId',
  handle('game line movements', async (req, res) => {
    const { gameId } = req.params;

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      return fail(res, 404, 'Game not found');
    }

    const sport = await prisma.sport.findUnique({
      where: { id: game.sportId },
      select: { name: true },
    });

    const movements = await lineMovementService.getGameMovements(
      gameId,
      clampInt(req.query.limit, 50, 1, 200)
    );

    ok(res, {
      game: {
        id: game.id,
        matchup: `${game.awayTeamName} @ ${game.homeTeamName}`,
        sport: sport?.name ?? 'Unknown',
        commenceTime: game.commenceTime,
      },
      movements,
      total: movements.length,
    });
  })
);

/**
 * GET /api/mcp/analytics/movements/stats
 * Query: hoursBack
 */
router.get(
  '/movements/stats',
  handle('line movement stats', async (req, res) => {
    const hoursBack = clampInt(req.query.hoursBack, 24, 1, 168);

    const stats = await lineMovementService.getMovementStats(hoursBack);
    const steamMoves = await lineMovementService.getMovementsByType('steam', hoursBack);

    ok(res, {
      period: `Last ${hoursBack} hours`,
      statistics: stats,
      steamMovesCount: steamMoves.length,
      totalMovements: Object.values(stats.byType).reduce(
        (a: number, b: number) => a + b,
        0
      ),
    });
  })
);

// ============================================================================
// MARKET DISAGREEMENT
// ============================================================================

/**
 * GET /api/mcp/analytics/disagreement/live
 * Query: threshold, limit
 */
router.get(
  '/disagreement/live',
  handle('market disagreement', async (req, res) => {
    const threshold = clampInt(req.query.threshold, 60, 1, 100);
    const games = await marketConsensusService.findHighDisagreement(
      threshold,
      clampInt(req.query.limit, 20, 1, 100)
    );

    ok(res, { games, threshold, count: games.length });
  })
);

/** GET /api/mcp/analytics/disagreement/game/:gameId */
router.get(
  '/disagreement/game/:gameId',
  handle('game disagreement', async (req, res) => {
    const consensus = await marketConsensusService.getDisagreementForGame(req.params.gameId);
    ok(res, consensus);
  })
);

// ============================================================================
// BOOKMAKER ANALYTICS
// ============================================================================

/**
 * GET /api/mcp/analytics/bookmakers/rankings
 * Query: criteria (value | sharpness | reliability | coverage | limits | recommendation)
 */
router.get(
  '/bookmakers/rankings',
  handle('bookmaker rankings', async (req, res) => {
    const validCriteria = [
      'value',
      'sharpness',
      'reliability',
      'coverage',
      'limits',
      'recommendation',
    ];
    const criteria = validCriteria.includes(String(req.query.criteria))
      ? String(req.query.criteria)
      : 'recommendation';

    const rankings = await bookmakerAnalyticsService.rankBookmakers(criteria);

    ok(res, { rankings, criteria, count: rankings.length });
  })
);

/** GET /api/mcp/analytics/bookmakers/sharp */
router.get(
  '/bookmakers/sharp',
  handle('sharp bookmakers', async (_req, res) => {
    const books = await prisma.bookmakerAnalytics.findMany({
      where: { sharpBookRating: { gte: 8 } },
      orderBy: { sharpBookRating: 'desc' },
    });

    ok(res, books);
  })
);

/**
 * GET /api/mcp/analytics/bookmakers/compare
 * Query: books (comma separated bookmaker keys, required)
 */
router.get(
  '/bookmakers/compare',
  handle('bookmaker comparison', async (req, res) => {
    const raw = req.query.books as string | undefined;
    if (!raw || raw.trim() === '') {
      return fail(res, 400, 'books query parameter is required (comma separated bookmaker keys)');
    }

    const bookmakers = raw
      .split(',')
      .map((b) => b.trim().toLowerCase())
      .filter(Boolean);

    if (bookmakers.length === 0) {
      return fail(res, 400, 'At least one bookmaker key is required');
    }

    const rows = await prisma.bookmakerAnalytics.findMany({
      where: { bookmaker: { in: bookmakers } },
    });

    ok(res, rows);
  })
);

/** GET /api/mcp/analytics/bookmakers/best-value/:sport */
router.get(
  '/bookmakers/best-value/:sport',
  handle('best value bookmakers', async (req, res) => {
    const { sport } = req.params;
    if (!sport || sport.trim() === '') {
      return fail(res, 400, 'sport is required');
    }

    const rows = await prisma.bookmakerAnalytics.findMany({
      where: { sportsCovered: { has: sport } },
      orderBy: { bestOddsFrequency: 'desc' },
    });

    ok(res, rows);
  })
);

/**
 * GET /api/mcp/analytics/bookmakers/:bookmaker/outliers
 * Query: days
 *
 * Declared before the bare `:bookmaker` route so the more specific path wins.
 */
router.get(
  '/bookmakers/:bookmaker/outliers',
  handle('bookmaker outlier stats', async (req, res) => {
    const { bookmaker } = req.params;
    if (!bookmaker || bookmaker.trim() === '') {
      return fail(res, 400, 'bookmaker is required');
    }

    const days = clampInt(req.query.days, 30, 1, 365);
    const stats = await marketConsensusService.getBookmakerOutlierStats(bookmaker, days);

    ok(res, { ...stats, days });
  })
);

/** GET /api/mcp/analytics/bookmakers/:bookmaker */
router.get(
  '/bookmakers/:bookmaker',
  handle('bookmaker metrics', async (req, res) => {
    const { bookmaker } = req.params;
    if (!bookmaker || bookmaker.trim() === '') {
      return fail(res, 400, 'bookmaker is required');
    }

    const row = await prisma.bookmakerAnalytics.findUnique({
      where: { bookmaker: bookmaker.trim().toLowerCase() },
    });

    if (!row) {
      return fail(
        res,
        404,
        `No analytics data yet for bookmaker "${bookmaker}". The daily analytics job runs at 02:00 UTC.`
      );
    }

    ok(res, row);
  })
);

export default router;
