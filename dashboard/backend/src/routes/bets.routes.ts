import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { betService } from '../services/bet.service';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { logger } from '../config/logger';
import {
  VALID_BET_TYPES,
  VALID_BET_STATUSES,
  VALID_SELECTION_TYPES,
  VALID_SELECTIONS
} from '../types/bet.types';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createBetLegSchema = z.object({
  gameId: z.string().uuid(),
  selectionType: z.enum(VALID_SELECTION_TYPES as [string, ...string[]]),
  selection: z.enum(VALID_SELECTIONS as [string, ...string[]]),
  teamName: z.string().optional(),
  line: z.number().optional(),
  odds: z.number(),
  userAdjustedLine: z.number().optional(),
  userAdjustedOdds: z.number().optional()
});

const createBetSchema = z.object({
  name: z.string().min(1).max(100),
  betType: z.enum(VALID_BET_TYPES as [string, ...string[]]),
  stake: z.number().positive(),
  legs: z.array(createBetLegSchema).min(1),
  teaserPoints: z.number().optional(),
  notes: z.string().max(500).optional()
});

const updateBetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  stake: z.number().positive().optional(),
  notes: z.string().max(500).optional()
});

const settleBetSchema = z.object({
  status: z.enum(['won', 'lost', 'push']),
  actualPayout: z.number().nonnegative().optional()
});

const getBetsQuerySchema = z.object({
  status: z.union([
    z.enum(VALID_BET_STATUSES as [string, ...string[]]),
    z.string() // Comma-separated statuses
  ]).optional(),
  betType: z.enum(VALID_BET_TYPES as [string, ...string[]]).optional(),
  sportKey: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional()
});

const getStatsQuerySchema = z.object({
  sportKey: z.string().optional(),
  betType: z.enum(VALID_BET_TYPES as [string, ...string[]]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

const uuidParamSchema = z.object({
  id: z.string().uuid()
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/bets/stats
 * Get betting statistics
 * Note: This must come BEFORE /:id route
 */
router.get(
  '/stats',
  validateQuery(getStatsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: any = {};

      if (req.query.sportKey) filters.sportKey = req.query.sportKey;
      if (req.query.betType) filters.betType = req.query.betType;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const stats = await betService.getStats(filters);

      res.json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/bets
 * List bets with filters
 */
router.get(
  '/',
  validateQuery(getBetsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: any = {};

      // Handle status (can be comma-separated)
      if (req.query.status) {
        const statusStr = req.query.status as string;
        filters.status = statusStr.includes(',')
          ? statusStr.split(',')
          : statusStr;
      }

      if (req.query.betType) filters.betType = req.query.betType;
      if (req.query.sportKey) filters.sportKey = req.query.sportKey;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.limit) filters.limit = Number(req.query.limit);
      if (req.query.offset) filters.offset = Number(req.query.offset);

      const result = await betService.getBets(filters);

      res.json({
        bets: result.bets,
        total: result.total,
        limit: result.limit,
        offset: result.offset
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/bets/:id
 * Get bet with all legs
 */
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bet = await betService.getBetById(req.params.id);

      if (!bet) {
        return res.status(404).json({
          status: 'error',
          message: 'Bet not found'
        });
      }

      res.json({
        status: 'success',
        data: bet
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/bets
 * Create new bet
 */
router.post(
  '/',
  validateBody(createBetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bet = await betService.createBet(req.body);

      res.status(201).json({
        status: 'success',
        data: bet
      });
    } catch (error) {
      logger.error('Error creating bet:', error);
      next(error);
    }
  }
);

/**
 * PATCH /api/bets/:id
 * Update bet (if pending)
 */
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateBetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bet = await betService.updateBet(req.params.id, req.body);

      res.json({
        status: 'success',
        data: bet
      });
    } catch (error) {
      logger.error('Error updating bet:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/bets/:id
 * Delete bet (supports ?force=true to delete any bet)
 */
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const force = req.query.force === 'true';
      await betService.cancelBet(req.params.id, force);

      res.json({
        status: 'success',
        message: 'Bet deleted'
      });
    } catch (error) {
      logger.error('Error deleting bet:', error);
      next(error);
    }
  }
);

/**
 * POST /api/bets/:id/settle
 * Manually settle bet
 */
router.post(
  '/:id/settle',
  validateParams(uuidParamSchema),
  validateBody(settleBetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, actualPayout } = req.body;
      const bet = await betService.settleBet(req.params.id, status, actualPayout);

      res.json({
        status: 'success',
        data: bet
      });
    } catch (error) {
      logger.error('Error settling bet:', error);
      next(error);
    }
  }
);

export default router;
