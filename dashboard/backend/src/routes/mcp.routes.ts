import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  getActiveBets,
  getBettingSummary,
  getAdviceContext,
  getGamesWithExposure,
  quickCreateBet
} from '../controllers/mcp.controller';

const router = Router();

// All MCP routes require authentication
router.use(authMiddleware);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const gamesWithExposureSchema = z.object({
  sport: z.string().optional(),
  onlyWithBets: z.string().optional() // 'true' or 'false'
});

const quickCreateBetSchema = z.object({
  game_id: z.string().uuid(),
  selection_type: z.enum(['moneyline', 'spread', 'total']),
  selection: z.enum(['home', 'away', 'over', 'under']),
  stake: z.number().positive(),
  odds: z.number(),
  line: z.number().optional(),
  name: z.string().max(100).optional()
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/mcp/bets/active
 * Get all pending bets for MCP integration
 */
router.get('/bets/active', getActiveBets);

/**
 * GET /api/mcp/bets/summary
 * Get quick betting summary for MCP
 */
router.get('/bets/summary', getBettingSummary);

/**
 * GET /api/mcp/bets/advice-context
 * Get full context for AI betting advice
 */
router.get('/bets/advice-context', getAdviceContext);

/**
 * GET /api/mcp/games/with-exposure
 * Get games with user's betting positions
 */
router.get(
  '/games/with-exposure',
  validateQuery(gamesWithExposureSchema),
  getGamesWithExposure
);

/**
 * POST /api/mcp/bets/quick-create
 * Simplified bet creation for MCP
 */
router.post(
  '/bets/quick-create',
  validateBody(quickCreateBetSchema),
  quickCreateBet
);

export default router;
