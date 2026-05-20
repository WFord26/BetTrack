import { Router, Response } from 'express';
import { bookmakerAnalyticsService } from '../services/bookmaker-analytics.service';
import { marketConsensusService } from '../services/market-consensus.service';
import { prisma } from '../config/database';
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
 * GET /api/analytics/bookmakers/sharp
 * Bookmakers with a sharpBookRating >= 8, ordered by rating descending.
 * Reads from the persisted bookmaker_analytics table (populated by the daily job).
 */
router.get('/sharp', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const books = await prisma.bookmakerAnalytics.findMany({
      where: { sharpBookRating: { gte: 8 } },
      orderBy: { sharpBookRating: 'desc' },
    });

    res.json({ success: true, data: books });
  } catch (error) {
    logger.error('Error fetching sharp bookmakers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sharp bookmakers' });
  }
});

/**
 * GET /api/analytics/bookmakers/compare?books=draftkings,fanduel,betmgm
 * Side-by-side comparison of the requested bookmakers.
 * Reads from the persisted bookmaker_analytics table.
 *
 * Query params:
 *   books  string  Comma-separated bookmaker keys (required)
 */
router.get('/compare', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const raw = req.query.books as string | undefined;
    if (!raw || raw.trim() === '') {
      return res.status(400).json({ success: false, error: 'books query parameter is required (comma-separated bookmaker keys)' });
    }

    const bookmakers = raw
      .split(',')
      .map((b) => b.trim().toLowerCase())
      .filter(Boolean);

    if (bookmakers.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one bookmaker key is required' });
    }

    const rows = await prisma.bookmakerAnalytics.findMany({
      where: { bookmaker: { in: bookmakers } },
    });

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error comparing bookmakers:', error);
    res.status(500).json({ success: false, error: 'Failed to compare bookmakers' });
  }
});

/**
 * GET /api/analytics/bookmakers/best-value/:sport
 * Bookmakers that cover the given sport, ordered by best odds frequency descending.
 * Reads from the persisted bookmaker_analytics table.
 *
 * Path params:
 *   sport  string  Sport key (e.g. basketball_nba, americanfootball_nfl)
 */
router.get('/best-value/:sport', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sport } = req.params;

    if (!sport || sport.trim() === '') {
      return res.status(400).json({ success: false, error: 'sport is required' });
    }

    const rows = await prisma.bookmakerAnalytics.findMany({
      where: { sportsCovered: { has: sport } },
      orderBy: { bestOddsFrequency: 'desc' },
    });

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error(`Error fetching best-value bookmakers for sport ${req.params.sport}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch best-value bookmakers' });
  }
});

/**
 * GET /api/analytics/bookmakers/movement/:bookmaker
 * First-mover events for the given bookmaker plus summary aggregates.
 * Reads from bookmaker_movement_events.
 *
 * Path params:
 *   bookmaker  string  Bookmaker key
 *
 * Query params:
 *   days  number  Look-back window in days (default 30, max 365)
 */
router.get('/movement/:bookmaker', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bookmaker } = req.params;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

    if (!bookmaker || bookmaker.trim() === '') {
      return res.status(400).json({ success: false, error: 'bookmaker is required' });
    }

    const normalizedBookmaker = bookmaker.trim().toLowerCase();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await prisma.bookmakerMovementEvent.findMany({
      where: {
        firstMover: normalizedBookmaker,
        detectedAt: { gte: cutoff },
      },
      orderBy: { detectedAt: 'desc' },
    });

    const totalFirstMoves = events.length;
    const avgMovementSize =
      totalFirstMoves > 0
        ? events.reduce((sum, e) => sum + parseFloat(e.movementSize.toString()), 0) / totalFirstMoves
        : 0;

    const followerSet = new Set<string>();
    for (const event of events) {
      const followers = (event.followers as Array<{ bookmaker?: string }>) ?? [];
      for (const f of followers) {
        if (f.bookmaker) followerSet.add(f.bookmaker);
      }
    }

    res.json({
      success: true,
      data: {
        bookmaker: normalizedBookmaker,
        days,
        totalFirstMoves,
        avgMovementSize: parseFloat(avgMovementSize.toFixed(2)),
        followerBooks: Array.from(followerSet).sort(),
        events,
      },
    });
  } catch (error) {
    logger.error(`Error fetching movement data for bookmaker ${req.params.bookmaker}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookmaker movement data' });
  }
});

// ─── Routes with dynamic :bookmaker segment — declared AFTER all static paths ────

/**
 * GET /api/analytics/bookmakers/:bookmaker
 * Full performance metrics for a single bookmaker.
 * Reads the persisted row from bookmaker_analytics (populated by the daily job).
 * Returns 404 if the row has not been computed yet.
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

    const row = await prisma.bookmakerAnalytics.findUnique({
      where: { bookmaker: bookmaker.trim().toLowerCase() },
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        error: `No analytics data yet for bookmaker "${bookmaker}". The daily analytics job runs at 02:00 UTC.`,
      });
    }

    res.json({
      success: true,
      data: {
        ...row,
        calculatedAt: row.calculatedAt,
      },
    });
  } catch (error) {
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
