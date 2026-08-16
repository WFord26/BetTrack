import { Router, Response } from 'express';
import {
  arbitrageService,
  buildStakePlan,
  ArbType,
  ArbMarketType,
} from '../services/arbitrage.service';
import { logger } from '../config/logger';
import {
  AuthenticatedRequest,
  requireSessionAuth,
  getScopedUserId,
} from '../middleware/auth-session.middleware';

const router = Router();

router.use(requireSessionAuth);

const ARB_TYPES: ArbType[] = ['two-way', 'three-way', 'middle'];
const MARKET_TYPES: ArbMarketType[] = ['h2h', 'spreads', 'totals'];

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
 * GET /api/analytics/arbitrage/live
 * Active opportunities, best profit first. Also feeds in-app notifications.
 *
 * Query params:
 *   limit           number  Max rows (default 25, max 100)
 *   minProfit       number  Minimum profit percentage
 *   arbType         string  two-way | three-way | middle
 *   marketType      string  h2h | spreads | totals
 *   maxSnapshotAge  number  Max age of the underlying odds snapshot, seconds
 */
router.get('/live', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = clampInt(req.query.limit, 25, 1, 100);
    const minProfit = optionalFloat(req.query.minProfit);
    const maxSnapshotAge = optionalFloat(req.query.maxSnapshotAge);
    const arbType = ARB_TYPES.includes(req.query.arbType as ArbType)
      ? (req.query.arbType as ArbType)
      : undefined;
    const marketType = MARKET_TYPES.includes(req.query.marketType as ArbMarketType)
      ? (req.query.marketType as ArbMarketType)
      : undefined;

    const opportunities = await arbitrageService.getLiveOpportunities({
      limit,
      minProfit,
      arbType,
      marketType,
      maxSnapshotAge: maxSnapshotAge === undefined ? undefined : Math.round(maxSnapshotAge),
    });

    res.json({
      success: true,
      data: {
        opportunities,
        count: opportunities.length,
        retrievedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching live arbitrage opportunities:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch arbitrage opportunities' });
  }
});

/**
 * GET /api/analytics/arbitrage/history
 * Previously detected opportunities.
 *
 * Query params:
 *   limit     number  Max rows (default 50, max 200)
 *   daysBack  number  Look-back window in days (default 7, max 90)
 *   status    string  active | expired | taken
 *   mine      bool    Restrict to the caller's taken opportunities
 */
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = clampInt(req.query.limit, 50, 1, 200);
    const daysBack = clampInt(req.query.daysBack, 7, 1, 90);
    const status = ['active', 'expired', 'taken'].includes(String(req.query.status))
      ? String(req.query.status)
      : undefined;
    const userId = req.query.mine === 'true' ? getScopedUserId(req) : undefined;

    const opportunities = await arbitrageService.getHistory({
      limit,
      daysBack,
      status,
      userId,
    });

    res.json({
      success: true,
      data: {
        opportunities,
        count: opportunities.length,
        period: `Last ${daysBack} days`,
      },
    });
  } catch (error) {
    logger.error('Error fetching arbitrage history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch arbitrage history' });
  }
});

/**
 * GET /api/analytics/arbitrage/stats
 * Detection and realisation statistics.
 *
 * Query params:
 *   daysBack  number  Look-back window in days (default 30, max 365)
 *   mine      bool    Restrict to the caller's taken opportunities
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const daysBack = clampInt(req.query.daysBack, 30, 1, 365);
    const userId = req.query.mine === 'true' ? getScopedUserId(req) : undefined;

    const stats = await arbitrageService.getStats({ daysBack, userId });

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching arbitrage stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch arbitrage stats' });
  }
});

/**
 * POST /api/analytics/arbitrage/calculator
 * Stateless stake calculator. Works for two-way and three-way sets.
 *
 * Body: { odds: number[], totalStake: number }
 */
router.post('/calculator', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { odds, totalStake } = req.body ?? {};

    if (!Array.isArray(odds) || odds.length < 2 || odds.length > 4) {
      return res.status(400).json({
        success: false,
        error: 'odds must be an array of 2 to 4 American odds values',
      });
    }

    if (odds.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Every entry in odds must be a non zero finite number',
      });
    }

    const stake = typeof totalStake === 'number' ? totalStake : parseFloat(String(totalStake));
    if (!Number.isFinite(stake) || stake <= 0) {
      return res.status(400).json({ success: false, error: 'totalStake must be a positive number' });
    }

    const plan = buildStakePlan(odds, stake);

    res.json({ success: true, data: plan });
  } catch (error) {
    logger.error('Error calculating arbitrage stakes:', error);
    const message = error instanceof Error ? error.message : 'Failed to calculate stakes';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * GET /api/analytics/arbitrage/:id
 * Full detail for a single opportunity.
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const opportunity = await arbitrageService.getById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }

    res.json({ success: true, data: opportunity });
  } catch (error) {
    logger.error(`Error fetching arbitrage opportunity ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch opportunity' });
  }
});

/**
 * POST /api/analytics/arbitrage/:id/take
 * Mark an opportunity as taken by the caller.
 *
 * Body: { actualProfit?: number }
 */
router.post('/:id/take', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actualProfit = optionalFloat(req.body?.actualProfit);
    const userId = getScopedUserId(req);

    const updated = await arbitrageService.markTaken(req.params.id, userId, actualProfit);

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error(`Error marking arbitrage opportunity ${req.params.id} as taken:`, error);
    res.status(500).json({ success: false, error: 'Failed to mark opportunity as taken' });
  }
});

export default router;
