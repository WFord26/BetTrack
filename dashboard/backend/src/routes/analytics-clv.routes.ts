import { Router, Request, Response } from 'express';
import { clvService } from '../services/clv.service';
import { logger } from '../config/logger';
import {
  AuthenticatedRequest,
  getScopedUserId,
  requireSessionAuth
} from '../middleware/session.auth';

const router = Router();

router.use(requireSessionAuth);

/**
 * GET /api/analytics/clv/summary
 * Get user's overall CLV summary statistics
 */
router.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await clvService.generateCLVReport(getScopedUserId(req));

    res.json({
      success: true,
      data: report.summary
    });
  } catch (error) {
    logger.error('Error fetching CLV summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CLV summary'
    });
  }
});

/**
 * GET /api/analytics/clv/by-sport
 * Get CLV breakdown by sport
 */
router.get('/by-sport', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await clvService.generateCLVReport(getScopedUserId(req));

    res.json({
      success: true,
      data: report.bySport
    });
  } catch (error) {
    logger.error('Error fetching CLV by sport:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CLV by sport'
    });
  }
});

/**
 * GET /api/analytics/clv/by-bookmaker
 * Get CLV breakdown by bookmaker
 */
router.get('/by-bookmaker', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await clvService.generateCLVReport(getScopedUserId(req));

    res.json({
      success: true,
      data: report.byBookmaker
    });
  } catch (error) {
    logger.error('Error fetching CLV by bookmaker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CLV by bookmaker'
    });
  }
});

/**
 * GET /api/analytics/clv/trends
 * Get CLV trends over time with filtering
 */
router.get('/trends', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sportKey, betType, startDate, endDate } = req.query;

    const filters: any = {};
    if (sportKey) filters.sportKey = sportKey as string;
    if (betType) filters.betType = betType as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const report = await clvService.generateCLVReport(getScopedUserId(req), filters);

    res.json({
      success: true,
      data: {
        summary: report.summary,
        topBets: report.topBets,
        worstBets: report.worstBets,
        bySport: report.bySport,
        byBookmaker: report.byBookmaker
      }
    });
  } catch (error) {
    logger.error('Error fetching CLV trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CLV trends'
    });
  }
});

/**
 * GET /api/analytics/clv/report
 * Get full CLV report with all details
 */
router.get('/report', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sportKey, betType, startDate, endDate } = req.query;

    const filters: any = {};
    if (sportKey) filters.sportKey = sportKey as string;
    if (betType) filters.betType = betType as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const report = await clvService.generateCLVReport(getScopedUserId(req), filters);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error generating CLV report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CLV report'
    });
  }
});

/**
 * POST /api/analytics/clv/calculate/:betId
 * Calculate CLV for a specific bet
 */
router.post('/calculate/:betId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { betId } = req.params;

    await clvService.calculateCLVForBetForUser(betId, getScopedUserId(req));

    res.json({
      success: true,
      message: 'CLV calculated successfully'
    });
  } catch (error) {
    logger.error(`Error calculating CLV for bet ${req.params.betId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate CLV'
    });
  }
});

/**
 * POST /api/analytics/clv/update-stats
 * Update aggregated CLV stats for current user
 */
router.post('/update-stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await clvService.updateCLVStats(getScopedUserId(req));

    res.json({
      success: true,
      message: 'CLV stats updated successfully'
    });
  } catch (error) {
    logger.error('Error updating CLV stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update CLV stats'
    });
  }
});

export default router;
