import { Router, Response } from 'express';
import { marketConsensusService } from '../services/market-consensus.service';
import { logger } from '../config/logger';
import {
  AuthenticatedRequest,
  requireSessionAuth,
} from '../middleware/auth-session.middleware';

const router = Router();

router.use(requireSessionAuth);

/**
 * GET /api/analytics/disagreement/live
 * Current high-disagreement games (score >= threshold, last 30 min).
 *
 * Query params:
 *   threshold  number  Min disagreement score (default 60)
 *   limit      number  Max games returned (default 20)
 */
router.get('/live', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const threshold = Math.min(100, Math.max(1, parseInt(req.query.threshold as string) || 60));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const games = await marketConsensusService.findHighDisagreement(threshold, limit);

    res.json({
      success: true,
      data: {
        games,
        threshold,
        count: games.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching live disagreement games:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch disagreement data' });
  }
});

/**
 * GET /api/analytics/disagreement/game/:gameId
 * Consensus breakdown for a specific game (latest per market type).
 */
router.get('/game/:gameId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const consensus = await marketConsensusService.getDisagreementForGame(gameId);

    res.json({
      success: true,
      data: consensus,
    });
  } catch (error) {
    logger.error(`Error fetching disagreement for game ${req.params.gameId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch game disagreement' });
  }
});

/**
 * GET /api/analytics/disagreement/trends
 * Historical disagreement data for a game (line movement + score over time).
 *
 * Query params:
 *   gameId      string  Required — game UUID
 *   marketType  string  Optional — filter by market (h2h, spreads, totals)
 */
router.get('/trends', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const gameId = req.query.gameId as string;
    if (!gameId) {
      return res.status(400).json({ success: false, error: 'gameId query param is required' });
    }

    const marketType = req.query.marketType as string | undefined;
    const history = await marketConsensusService.getDisagreementHistory(gameId, marketType);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error fetching disagreement trends:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch disagreement trends' });
  }
});

/**
 * GET /api/analytics/disagreement/bookmaker/:bookmaker
 * How often a specific bookmaker is an outlier.
 *
 * Query params:
 *   days  number  Look-back window in days (default 30)
 */
router.get('/bookmaker/:bookmaker', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bookmaker } = req.params;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

    const stats = await marketConsensusService.getBookmakerOutlierStats(bookmaker, days);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error(
      `Error fetching bookmaker outlier stats for ${req.params.bookmaker}:`,
      error
    );
    res.status(500).json({ success: false, error: 'Failed to fetch bookmaker stats' });
  }
});

export default router;
