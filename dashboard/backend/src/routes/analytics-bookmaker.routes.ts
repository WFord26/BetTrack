import { Router, Response } from 'express';
import { bookmakerAnalyticsService } from '../services/bookmaker-analytics.service';
import { marketConsensusService } from '../services/market-consensus.service';
import { logger } from '../config/logger';
import {
  AuthenticatedRequest,
  requireSessionAuth,
} from '../middleware/auth-session.middleware';

const router = Router();

router.use(requireSessionAuth);

/**
 * GET /api/analytics/bookmakers/rankings
 * Ranked list of all bookmakers by the given criteria.
 *
 * Query params:
 *   criteria  string  One of: value, sharpness, reliability, coverage, limits, recommendation (default: recommendation)
 */
router.get('/rankings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validCriteria = ['value', 'sharpness', 'reliability', 'coverage', 'limits', 'recommendation'];
    const criteria = validCriteria.includes(req.query.criteria as string)
      ? (req.query.criteria as string)
      : 'recommendation';

    const rankings = await bookmakerAnalyticsService.rankBookmakers(criteria);

    res.json({
      success: true,
      data: {
        rankings,
        criteria,
        count: rankings.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching bookmaker rankings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookmaker rankings' });
  }
});

/**
 * GET /api/analytics/bookmakers/:bookmaker
 * Full performance metrics for a single bookmaker.
 *
 * Path params:
 *   bookmaker  string  Bookmaker key (e.g. draftkings, fanduel)
 */
router.get('/:bookmaker', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bookmaker } = req.params;

    if (!bookmaker || bookmaker.trim() === '') {
      return res.status(400).json({ success: false, error: 'bookmaker is required' });
    }

    const metrics = await bookmakerAnalyticsService.calculateBookmakerMetrics(bookmaker);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    if (error?.message === 'bookmaker is required') {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error(`Error fetching metrics for bookmaker ${req.params.bookmaker}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookmaker metrics' });
  }
});

/**
 * GET /api/analytics/bookmakers/:bookmaker/outliers
 * Outlier frequency and deviation stats for a bookmaker over a rolling window.
 *
 * Path params:
 *   bookmaker  string  Bookmaker key
 *
 * Query params:
 *   days  number  Look-back window in days (default 30, max 365)
 */
router.get('/:bookmaker/outliers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bookmaker } = req.params;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

    if (!bookmaker || bookmaker.trim() === '') {
      return res.status(400).json({ success: false, error: 'bookmaker is required' });
    }

    const stats = await marketConsensusService.getBookmakerOutlierStats(bookmaker, days);

    res.json({
      success: true,
      data: {
        ...stats,
        days,
      },
    });
  } catch (error) {
    logger.error(`Error fetching outlier stats for bookmaker ${req.params.bookmaker}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch outlier stats' });
  }
});

export default router;
