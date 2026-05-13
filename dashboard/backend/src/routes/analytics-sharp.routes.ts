import { Router, Response } from 'express';
import { sharpIndicatorService } from '../services/sharp-indicator.service';
import { logger } from '../config/logger';
import {
  AuthenticatedRequest,
  requireSessionAuth,
} from '../middleware/auth-session.middleware';
import { prisma } from '../config/database';

const router = Router();

router.use(requireSessionAuth);

/**
 * GET /api/analytics/sharp/live
 * Current sharp-money indicators for scheduled games.
 *
 * Query params:
 *   limit   number  Max games returned (default 20)
 */
router.get('/live', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const indicators = await sharpIndicatorService.getLatestIndicators(limit);

    res.json({
      success: true,
      data: {
        indicators,
        count: indicators.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching live sharp indicators:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sharp indicators' });
  }
});

/**
 * GET /api/analytics/sharp/game/:gameId
 * Sharp indicators for a specific game (latest per market type).
 */
router.get('/game/:gameId', async (req: AuthenticatedRequest, res: Response) => {
  try {
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
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    const indicators = await sharpIndicatorService.getIndicatorsForGame(gameId);

    res.json({
      success: true,
      data: {
        game: {
          id: game.id,
          matchup: `${game.homeTeamName} vs ${game.awayTeamName}`,
          sport: game.sport.name,
          sportKey: game.sport.key,
          commenceTime: game.commenceTime,
          status: game.status,
        },
        indicators,
      },
    });
  } catch (error) {
    logger.error(`Error fetching sharp indicators for game ${req.params.gameId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch game indicators' });
  }
});

/**
 * GET /api/analytics/sharp/contrarian
 * Games where sharp money opposes likely public action (fade-the-public picks).
 *
 * Query params:
 *   minConfidence  number  Min sharp confidence score 1-10 (default 6)
 *   limit          number  Max games returned (default 20)
 */
router.get('/contrarian', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const minConfidence = Math.min(10, Math.max(1, parseInt(req.query.minConfidence as string) || 6));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const opportunities = await sharpIndicatorService.findContrarianOpportunities(minConfidence, limit);

    res.json({
      success: true,
      data: {
        opportunities,
        count: opportunities.length,
        minConfidence,
      },
    });
  } catch (error) {
    logger.error('Error fetching contrarian opportunities:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch contrarian opportunities' });
  }
});

/**
 * GET /api/analytics/sharp/stats
 * Summary statistics for sharp indicators.
 *
 * Query params:
 *   hoursBack  number  Look-back window in hours (default 24)
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const hoursBack = Math.min(168, Math.max(1, parseInt(req.query.hoursBack as string) || 24));
    const stats = await sharpIndicatorService.getStats(hoursBack);

    res.json({
      success: true,
      data: {
        ...stats,
        period: `Last ${hoursBack} hours`,
      },
    });
  } catch (error) {
    logger.error('Error fetching sharp stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sharp stats' });
  }
});

export default router;
