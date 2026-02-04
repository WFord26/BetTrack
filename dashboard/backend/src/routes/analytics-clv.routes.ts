import { Router, Request, Response } from 'express';
import { clvService } from '../services/clv.service';
import { logger } from '../config/logger';

const router = Router();

// Type declaration for user property (will be added by auth middleware in future)
interface RequestWithUser extends Request {
  user?: {
    id: string;
  };
}

/**
 * GET /api/analytics/clv/summary
 * Get user's overall CLV summary statistics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // In standalone mode, use default user ID
    const userId = (req as RequestWithUser).user?.id || 'default-user-id';

    const report = await clvService.generateCLVReport(userId);

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
router.get('/by-sport', async (req: Request, res: Response) => {
  try {
    const userId = (req as RequestWithUser).user?.id || 'default-user-id';

    const report = await clvService.generateCLVReport(userId);

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
router.get('/by-bookmaker', async (req: Request, res: Response) => {
  try {
    const userId = (req as RequestWithUser).user?.id || 'default-user-id';

    const report = await clvService.generateCLVReport(userId);

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
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const userId = (req as RequestWithUser).user?.id || 'default-user-id';
    const { sportKey, betType, startDate, endDate } = req.query;

    const filters: any = {};
    if (sportKey) filters.sportKey = sportKey as string;
    if (betType) filters.betType = betType as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const report = await clvService.generateCLVReport(userId, filters);

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
router.get('/report', async (req: Request, res: Response) => {
  try {
    const userId = (req as RequestWithUser).user?.id || 'default-user-id';
    const { sportKey, betType, startDate, endDate } = req.query;

    const filters: any = {};
    if (sportKey) filters.sportKey = sportKey as string;
    if (betType) filters.betType = betType as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const report = await clvService.generateCLVReport(userId, filters);

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
router.post('/calculate/:betId', async (req: Request, res: Response) => {
  try {
    const { betId } = req.params;

    await clvService.calculateCLVForBet(betId);

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
router.post('/update-stats', async (req: Request, res: Response) => {
  try {
    const userId = (req as RequestWithUser).user?.id || 'default-user-id';

    await clvService.updateCLVStats(userId);

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
