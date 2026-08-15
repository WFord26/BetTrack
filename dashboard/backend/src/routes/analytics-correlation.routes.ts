import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  AuthenticatedRequest,
  requireSessionAuth,
  getScopedUserId,
} from '../middleware/auth-session.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { correlationService, CreateBetLegInput, RiskLevel } from '../services/correlation.service';
import { VALID_SELECTION_TYPES, VALID_SELECTIONS } from '../types/bet.types';

const router = Router();

router.use(requireSessionAuth);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const analyzePairSchema = z.object({
  betLeg1Id: z.string().uuid(),
  betLeg2Id: z.string().uuid(),
});

const draftLegSchema = z.object({
  gameId: z.string().uuid(),
  selectionType: z.enum(VALID_SELECTION_TYPES as [string, ...string[]]),
  selection: z.enum(VALID_SELECTIONS as [string, ...string[]]),
  teamName: z.string().optional(),
  line: z.number().optional(),
  odds: z.number(),
  sgpGroupId: z.string().optional(),
});

const analyzeParlaySchema = z.object({
  betId: z.string().uuid().optional(),
  legs: z.array(draftLegSchema).optional(),
}).refine((data) => Boolean(data.betId) !== Boolean(data.legs), {
  message: 'Provide exactly one of betId (placed bet) or legs (draft slip)',
});

const hedgeSchema = z.object({
  betLegId: z.string().uuid(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  mine: z.coerce.boolean().optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/analytics/correlation/analyze
 * Correlation between two existing bet legs.
 */
router.post(
  '/analyze',
  validateBody(analyzePairSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { betLeg1Id, betLeg2Id } = req.body;
      const correlation = await correlationService.analyzeLegPair(betLeg1Id, betLeg2Id);

      res.json({
        success: true,
        data: {
          correlated: correlation !== null,
          correlation,
        },
      });
    } catch (error) {
      logger.error('Error analyzing leg correlation:', error);
      const message = error instanceof Error ? error.message : 'Failed to analyze correlation';
      const status = message.includes('not found') ? 404 : 500;
      res.status(status).json({ success: false, error: message });
    }
  }
);

/**
 * POST /api/analytics/correlation/parlay
 * Analyze a parlay — either a placed `Bet` (betId) or a draft slip (legs).
 */
router.post(
  '/parlay',
  validateBody(analyzeParlaySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getScopedUserId(req);

      if (req.body.betId) {
        const result = await correlationService.analyzeParlay(req.body.betId, userId);
        res.json({ success: true, data: result });
        return;
      }

      const legs: CreateBetLegInput[] = req.body.legs;
      const gameIds = [...new Set(legs.map((leg) => leg.gameId))];
      const games = await prisma.game.findMany({
        where: { id: { in: gameIds } },
        select: { id: true, commenceTime: true },
      });
      const gameCommenceTimes = new Map(games.map((g) => [g.id, g.commenceTime]));

      const result = await correlationService.analyzeDraftSlip(legs, gameCommenceTimes);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error analyzing parlay:', error);
      const message = error instanceof Error ? error.message : 'Failed to analyze parlay';
      const status = message.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: message });
    }
  }
);

/**
 * GET /api/analytics/correlation/history
 * Historical ParlayAnalysis records.
 */
router.get(
  '/history',
  validateQuery(historyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const scopedUserId = getScopedUserId(req);
      const mine = req.query.mine !== 'false'; // default: scope to caller when auth is enabled
      const userId = mine ? scopedUserId : undefined;

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 25;
      const riskLevel = req.query.riskLevel as RiskLevel | undefined;

      const history = await correlationService.getHistory({ userId, limit, riskLevel });

      res.json({
        success: true,
        data: { analyses: history, count: history.length },
      });
    } catch (error) {
      logger.error('Error fetching correlation history:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch correlation history' });
    }
  }
);

/**
 * POST /api/analytics/correlation/hedge
 * Pre-game hedging opportunities for a moneyline leg.
 */
router.post(
  '/hedge',
  validateBody(hedgeSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const opportunities = await correlationService.findHedgingOpportunities(req.body.betLegId);
      res.json({
        success: true,
        data: { opportunities, count: opportunities.length },
      });
    } catch (error) {
      logger.error('Error finding hedging opportunities:', error);
      const message = error instanceof Error ? error.message : 'Failed to find hedging opportunities';
      const status = message.includes('not found') ? 404 : 500;
      res.status(status).json({ success: false, error: message });
    }
  }
);

/**
 * GET /api/analytics/correlation/education
 * Static educational content — correlation types, glossary, worked examples.
 */
router.get('/education', (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      correlationTypes: [
        {
          type: 'same-game',
          label: 'Same-Game Correlation',
          summary: 'Legs in the same game that tend to move together, like a spread and a total.',
          example: 'Betting a team to cover -7 and the game to go Over both benefit from that team controlling the game.',
        },
        {
          type: 'derivative',
          label: 'Derivative Correlation',
          summary: 'A market that is mathematically derived from another — a moneyline and a small spread on the same side.',
          example: 'A -2.5 spread and the moneyline on the same favorite almost always win or lose together.',
        },
        {
          type: 'inverse',
          label: 'Inverse (Mutually Exclusive)',
          summary: 'Outcomes that cannot both happen — betting both teams to win the same game outright.',
          example: 'Home moneyline + Away moneyline on the same game can never both win.',
        },
        {
          type: 'temporal',
          label: 'Temporal Correlation',
          summary: 'The same team in two different games close together, where fatigue/rest links the outcomes.',
          example: 'A team playing on the second night of a back-to-back is more likely to underperform in both games.',
        },
      ],
      glossary: [
        { term: 'True Odds', definition: 'The correlation-adjusted payout a parlay actually offers, versus the advertised nominal odds.' },
        { term: 'Odds Discrepancy', definition: 'The percentage gap between nominal (advertised) odds and true (correlation-adjusted) odds.' },
        { term: 'Hedging', definition: 'Placing a bet on the opposite outcome of an existing wager to lock in profit or reduce risk.' },
        { term: 'SGP (Same-Game Parlay)', definition: 'A parlay whose legs all come from one game — books price these with correlation already baked in.' },
      ],
      warningLevels: [
        { level: 'low', threshold: '< 30% correlation', icon: '🟢' },
        { level: 'medium', threshold: '30–60% correlation', icon: '🟡' },
        { level: 'high', threshold: '> 60% correlation', icon: '🔴' },
        { level: 'blocked', threshold: 'inverse (mutually exclusive)', icon: '⛔' },
      ],
    },
  });
});

export default router;
