import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { LineMovementService } from '../services/line-movement.service';
import { requireSessionAuth, AuthenticatedRequest } from '../middleware/auth-session.middleware';
import { logger as routeLogger } from '../config/logger';

export function createLineMovementRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const lineMovementService = new LineMovementService();

  // Apply auth middleware to all routes
  router.use(requireSessionAuth);

  /**
   * GET /api/analytics/movements/live
   * Get recent steam moves and active movements in real-time
   * Query params: 
   *   - limit (default 20)
   *   - hoursBack (default 4)
   *   - movementType (steam, reverse, gradual, injury)
   */
  router.get('/live', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const hoursBack = parseInt(req.query.hoursBack as string) || 4;
      const movementType = (req.query.movementType as string) || 'steam';

      let movements;

      if (movementType === 'all') {
        movements = await lineMovementService.getRecentMovements(hoursBack);
      } else {
        const validTypes = ['steam', 'reverse', 'gradual', 'injury'];
        if (!validTypes.includes(movementType)) {
          return res.status(400).json({
            status: 'error',
            error: 'Invalid movementType. Must be steam, reverse, gradual, injury, or all',
            data: null,
          });
        }
        movements = await lineMovementService.getMovementsByType(
          movementType as any,
          hoursBack
        );
      }

      res.json({
        status: 'success',
        data: {
          movements: movements.slice(0, limit),
          total: movements.length,
          hoursBack,
          movementType,
        },
      });
    } catch (error) {
      routeLogger.error('Error fetching live movements:', error);
      res.status(500).json({
        status: 'error',
        error: 'Failed to fetch movements',
        data: null,
      });
    }
  });

  /**
   * GET /api/analytics/movements/game/:gameId
   * Get all movements for a specific game
   * Query params:
   *   - limit (default 50)
   */
  router.get('/game/:gameId', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      // Verify game exists
      const game = await prisma.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return res.status(404).json({
          status: 'error',
          error: 'Game not found',
          data: null,
        });
      }

      // Get sport title
      const sport = await prisma.sport.findUnique({
        where: { id: game.sportId },
        select: { name: true }
      });

      const movements = await lineMovementService.getGameMovements(gameId, limit);

      res.json({
        status: 'success',
        data: {
          game: {
            id: game.id,
            matchup: `${game.homeTeamName} vs ${game.awayTeamName}`,
            sport: sport?.name || 'Unknown',
            commenceTime: game.commenceTime,
          },
          movements,
          total: movements.length,
        },
      });
    } catch (error) {
      routeLogger.error('Error fetching game movements:', error);
      res.status(500).json({
        status: 'error',
        error: 'Failed to fetch movements',
        data: null,
      });
    }
  });

  /**
   * GET /api/analytics/movements/history
   * Get historical movement data with statistics
   * Query params:
   *   - hoursBack (default 24)
   *   - movementType (optional: steam, reverse, gradual, injury)
   */
  router.get('/history', async (req: Request, res: Response) => {
    try {
      const hoursBack = parseInt(req.query.hoursBack as string) || 24;
      const movementType = (req.query.movementType as string) || null;

      const stats = await lineMovementService.getMovementStats(hoursBack);

      let movements;
      if (movementType) {
        const validTypes = ['steam', 'reverse', 'gradual', 'injury'];
        if (!validTypes.includes(movementType)) {
          return res.status(400).json({
            status: 'error',
            error: 'Invalid movementType. Must be steam, reverse, gradual, or injury',
            data: null,
          });
        }
        movements = await lineMovementService.getMovementsByType(movementType as any, hoursBack);
      } else {
        movements = await lineMovementService.getRecentMovements(hoursBack);
      }

      // Group movements by date
      const byDate: Record<string, any[]> = {};
      for (const movement of movements) {
        const dateKey = movement.detectedAt.toISOString().split('T')[0];
        if (!byDate[dateKey]) {
          byDate[dateKey] = [];
        }
        byDate[dateKey].push(movement);
      }

      res.json({
        status: 'success',
        data: {
          statistics: stats,
          movements: movements.slice(0, 200),
          byDate,
          hoursBack,
          period: `Last ${hoursBack} hours`,
        },
      });
    } catch (error) {
      routeLogger.error('Error fetching movement history:', error);
      res.status(500).json({
        status: 'error',
        error: 'Failed to fetch history',
        data: null,
      });
    }
  });

  /**
   * GET /api/analytics/movements/bookmaker/:bookmaker
   * Get movements detected by a specific bookmaker
   * Query params:
   *   - hoursBack (default 24)
   *   - marketType (optional: h2h, spreads, totals)
   */
  router.get('/bookmaker/:bookmaker', async (req: Request, res: Response) => {
    try {
      const { bookmaker } = req.params;
      const hoursBack = parseInt(req.query.hoursBack as string) || 24;
      const marketType = (req.query.marketType as string) || null;

      const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      // Get all movements in the time window
      let movements = await prisma.lineMovement.findMany({
        where: {
          detectedAt: { gte: cutoff },
        },
        include: { game: true },
        orderBy: { detectedAt: 'desc' },
      });

      // Filter by bookmaker presence in linesBefore/linesAfter
      movements = movements.filter(m => {
        const before = m.linesBefore as Record<string, any>;
        const after = m.linesAfter as Record<string, any>;
        return before[bookmaker] || after[bookmaker];
      });

      // Optionally filter by market type
      if (marketType) {
        movements = movements.filter(m => m.marketType === marketType);
      }

      // Calculate impact of this bookmaker on movements
      const impactStats = {
        totalMovements: movements.length,
        steamMoves: movements.filter(m => m.movementType === 'steam').length,
        avgMovementSize: movements.length
          ? (movements.reduce((sum, m) => sum + m.averageMovement.toNumber(), 0) /
              movements.length).toFixed(2)
          : '0',
      };

      res.json({
        status: 'success',
        data: {
          bookmaker,
          hoursBack,
          impactStats,
          recentMovements: movements.slice(0, 50),
        },
      });
    } catch (error) {
      routeLogger.error('Error fetching bookmaker movements:', error);
      res.status(500).json({
        status: 'error',
        error: 'Failed to fetch bookmaker movements',
        data: null,
      });
    }
  });

  /**
   * GET /api/analytics/movements/stats
   * Get summary statistics on line movements
   * Query params:
   *   - hoursBack (default 24)
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const hoursBack = parseInt(req.query.hoursBack as string) || 24;

      const stats = await lineMovementService.getMovementStats(hoursBack);
      const steamMoves = await lineMovementService.getMovementsByType('steam', hoursBack);

      res.json({
        status: 'success',
        data: {
          period: `Last ${hoursBack} hours`,
          statistics: stats,
          steamMovesCount: steamMoves.length,
          totalMovements: Object.values(stats.byType).reduce((a, b) => a + b, 0),
        },
      });
    } catch (error) {
      routeLogger.error('Error fetching movement stats:', error);
      res.status(500).json({
        status: 'error',
        error: 'Failed to fetch statistics',
        data: null,
      });
    }
  });

  return router;
}
