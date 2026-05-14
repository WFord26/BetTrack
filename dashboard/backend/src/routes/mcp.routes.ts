import { Router } from 'express';
import { z } from 'zod';
import { apiKeyAuth, requirePermission } from '../middleware/api-key-auth';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  getActiveBets,
  getBettingSummary,
  getAdviceContext,
  getGamesWithExposure,
  quickCreateBet,
  getMcpGames,
  getMcpBets,
  getMcpBetById,
  getMcpGameOdds,
  searchTeams
} from '../controllers/mcp.controller';

const router = Router();

// All MCP routes require API key authentication
router.use(apiKeyAuth);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const gamesWithExposureSchema = z.object({
  sport: z.string().optional(),
  onlyWithBets: z.string().optional() // 'true' or 'false'
});

const mcpBetsQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional()
});

const mcpGamesQuerySchema = z.object({
  sport: z.string().optional(),
  status: z.string().optional()
});

const teamSearchQuerySchema = z.object({
  q: z.string().min(1)
});

const quickCreateBetSchema = z.object({
  game_id: z.string().uuid(),
  selection_type: z.enum(['moneyline', 'spread', 'total']),
  selection: z.enum(['home', 'away', 'over', 'under']),
  stake: z.number().positive(),
  odds: z.number().refine(
    o => Math.abs(o) >= 100,
    { message: 'American odds must be ≤ -100 or ≥ +100' }
  ),
  line: z.number().optional(),
  name: z.string().max(100).optional()
});

// ============================================================================
// EXISTING MCP ROUTES (purpose-built AI endpoints)
// ============================================================================

/**
 * GET /api/mcp/bets/active
 * Get all pending bets for MCP integration
 */
router.get('/bets/active', requirePermission('bets'), getActiveBets);

/**
 * GET /api/mcp/bets/summary
 * Get quick betting summary for MCP
 */
router.get('/bets/summary', requirePermission('stats'), getBettingSummary);

/**
 * GET /api/mcp/bets/advice-context
 * Get full context for AI betting advice
 */
router.get('/bets/advice-context', requirePermission('stats'), getAdviceContext);

/**
 * GET /api/mcp/games/with-exposure
 * Get games with user's betting positions
 */
router.get(
  '/games/with-exposure',
  requirePermission('bets'),
  validateQuery(gamesWithExposureSchema),
  getGamesWithExposure
);

/**
 * POST /api/mcp/bets/quick-create
 * Simplified bet creation for MCP
 */
router.post(
  '/bets/quick-create',
  requirePermission('write'),
  requirePermission('bets'),
  validateBody(quickCreateBetSchema),
  quickCreateBet
);

// ============================================================================
// GENERAL MCP ROUTES (replaces /api/* session-gated routes for MCP callers)
// ============================================================================

/**
 * GET /api/mcp/games
 * List upcoming games (replaces /api/games for MCP)
 */
router.get('/games', requirePermission('bets'), validateQuery(mcpGamesQuerySchema), getMcpGames);

/**
 * GET /api/mcp/games/:id/odds
 * Get current odds for a specific game
 */
router.get('/games/:id/odds', getMcpGameOdds);

/**
 * GET /api/mcp/bets
 * List bets with optional filters (replaces /api/bets for MCP)
 */
router.get('/bets', requirePermission('bets'), validateQuery(mcpBetsQuerySchema), getMcpBets);

/**
 * GET /api/mcp/bets/:id
 * Get a single bet by ID, scoped to calling user
 */
router.get('/bets/:id', requirePermission('bets'), getMcpBetById);

/**
 * GET /api/mcp/teams/search?q=
 * Search teams by name
 */
router.get('/teams/search', validateQuery(teamSearchQuerySchema), searchTeams);

export default router;
