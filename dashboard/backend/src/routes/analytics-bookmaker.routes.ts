import { Router, Response } from 'express';
import { z } from 'zod';
import { bookmakerAnalyticsService } from '../services/bookmaker-analytics.service';
import { marketConsensusService } from '../services/market-consensus.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  AuthenticatedRequest,
  getUserId,
  requireSessionAuth,
} from '../middleware/auth-session.middleware';

const router = Router();

/** Matches the normalization BookmakerAnalyticsService applies before persisting. */
function normalizeBookmaker(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

const createReportSchema = z.object({
  reportType: z.enum(['OUTAGE', 'LIMIT_REDUCTION']),
  note: z.string().max(280).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** One outage report per user per book per 24h; one limit report per 30 days. */
const REPORT_RATE_LIMIT_MS: Record<'OUTAGE' | 'LIMIT_REDUCTION', number> = {
  OUTAGE: DAY_MS,
  LIMIT_REDUCTION: 30 * DAY_MS,
};

/** Must match BookmakerAnalyticsService.LOOKBACK_DAYS so the panel shows the same window. */
const REPORT_SUMMARY_WINDOW_DAYS = 30;

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

/**
 * POST /api/analytics/bookmakers/:bookmaker/reports
 * Submit a user report about a bookmaker (outage, or account limit reduction).
 *
 * Rate-limited per user per bookmaker per report type, enforced against
 * bookmaker_reports rather than the in-process rate-limit middleware, which is
 * per-replica and loses state on restart. See GitHub issue #97.
 */
router.post('/:bookmaker/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Bookmaker reports require a signed-in user and are unavailable in standalone mode',
      });
    }

    const bookmaker = normalizeBookmaker(req.params.bookmaker);
    if (!bookmaker) {
      return res.status(400).json({ success: false, error: 'bookmaker is required' });
    }

    // Reports must attach to a bookmaker we actually track, so they cannot be
    // filed against arbitrary strings.
    const known = await prisma.bookmakerAnalytics.findUnique({
      where: { bookmaker },
      select: { bookmaker: true },
    });
    if (!known) {
      return res.status(404).json({ success: false, error: `Unknown bookmaker: ${bookmaker}` });
    }

    const { reportType, note } = parsed.data;
    const windowMs = REPORT_RATE_LIMIT_MS[reportType];
    const since = new Date(Date.now() - windowMs);

    const recent = await prisma.bookmakerReport.findFirst({
      where: { userId, bookmaker, reportType, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (recent) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((recent.createdAt.getTime() + windowMs - Date.now()) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: `You have already submitted a ${reportType} report for ${bookmaker} recently. Try again later.`,
        retryAfterSeconds,
      });
    }

    const report = await prisma.bookmakerReport.create({
      data: { userId, bookmaker, reportType, note: note ?? null },
      select: { id: true, bookmaker: true, reportType: true, createdAt: true },
    });

    logger.info(`Bookmaker report submitted: ${reportType} for ${bookmaker}`);

    return res.status(201).json({ success: true, data: report });
  } catch (error) {
    logger.error(`Error submitting report for bookmaker ${req.params.bookmaker}:`, error);
    return res.status(500).json({ success: false, error: 'Failed to submit bookmaker report' });
  }
});

/**
 * GET /api/analytics/bookmakers/:bookmaker/reports/summary
 * Report counts feeding the current analytics row, plus the timestamp of the
 * last analytics run so the UI can show how stale the derived Uptime is.
 */
router.get('/:bookmaker/reports/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookmaker = normalizeBookmaker(req.params.bookmaker);
    if (!bookmaker) {
      return res.status(400).json({ success: false, error: 'bookmaker is required' });
    }

    const since = new Date(Date.now() - REPORT_SUMMARY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [reports, analytics] = await Promise.all([
      prisma.bookmakerReport.findMany({
        where: { bookmaker, createdAt: { gte: since } },
        select: { userId: true, reportType: true, createdAt: true },
      }),
      prisma.bookmakerAnalytics.findUnique({
        where: { bookmaker },
        select: { uptimePercentage: true, accountLimitReports: true, calculatedAt: true },
      }),
    ]);

    // Mirrors the service's dedup: distinct (user, day) for outages, distinct users for limits.
    const outageDays = new Set<string>();
    const limitUsers = new Set<string>();
    for (const report of reports) {
      if (report.reportType === 'LIMIT_REDUCTION') {
        limitUsers.add(report.userId);
      } else {
        outageDays.add(`${report.userId}:${report.createdAt.toISOString().slice(0, 10)}`);
      }
    }

    return res.json({
      success: true,
      data: {
        bookmaker,
        windowDays: REPORT_SUMMARY_WINDOW_DAYS,
        outageReporterDays: outageDays.size,
        limitReductionReporters: limitUsers.size,
        uptimePercentage: analytics?.uptimePercentage ?? null,
        accountLimitReports: analytics?.accountLimitReports ?? 0,
        calculatedAt: analytics?.calculatedAt ?? null,
      },
    });
  } catch (error) {
    logger.error(`Error fetching report summary for bookmaker ${req.params.bookmaker}:`, error);
    return res.status(500).json({ success: false, error: 'Failed to fetch report summary' });
  }
});

export default router;
