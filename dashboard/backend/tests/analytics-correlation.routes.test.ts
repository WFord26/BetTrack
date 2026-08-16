/**
 * Integration tests for the correlation analytics routes.
 * Covers /analyze, /parlay, /history, /hedge, and /education.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

jest.mock('../src/services/session-store.service', () => ({
  initializeSessionStore: jest.fn(),
  shutdownSessionStore: jest.fn(),
  getSessionStore: jest.fn(() => ({
    get: jest.fn(), set: jest.fn(), delete: jest.fn(), clear: jest.fn(),
  })),
  sessionStore: {
    get: jest.fn(), set: jest.fn(), delete: jest.fn(), clear: jest.fn(),
  },
}));

jest.mock('../src/middleware/auth-session.middleware', () => ({
  requireSessionAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  isAuthEnabled: jest.fn(() => false),
  getScopedUserId: jest.fn(() => undefined),
  getUserId: jest.fn(() => null),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
  attachAuthSession: jest.fn((_req: any, _res: any, next: any) => next()),
}));

jest.mock('../src/config/database', () => ({
  prisma: {
    game: { findMany: jest.fn() },
  },
}));

jest.mock('../src/services/correlation.service', () => {
  const actual: any = jest.requireActual('../src/services/correlation.service');
  return {
    ...actual,
    correlationService: {
      analyzeLegPair: jest.fn(),
      analyzeParlay: jest.fn(),
      analyzeDraftSlip: jest.fn(),
      getHistory: jest.fn(),
      findHedgingOpportunities: jest.fn(),
    },
  };
});

import app from '../src/app';
import { correlationService } from '../src/services/correlation.service';
import { prisma } from '../src/config/database';
import { getScopedUserId } from '../src/middleware/auth-session.middleware';

const mockService = correlationService as jest.Mocked<typeof correlationService>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetScopedUserId = getScopedUserId as jest.Mock;

describe('Analytics Correlation Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /analyze ────────────────────────────────────────────────────────
  describe('POST /api/analytics/correlation/analyze', () => {
    it('returns the correlation between two legs', async () => {
      mockService.analyzeLegPair.mockResolvedValue({
        type: 'inverse',
        score: -1,
        confidence: 1,
        reasoning: 'Mutually exclusive outcomes — cannot both win',
        factors: ['game_result'],
      } as any);

      const res = await request(app)
        .post('/api/analytics/correlation/analyze')
        .send({ betLeg1Id: '11111111-1111-1111-1111-111111111111', betLeg2Id: '22222222-2222-2222-2222-222222222222' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.correlated).toBe(true);
      expect(res.body.data.correlation.type).toBe('inverse');
    });

    it('returns 400 for invalid UUIDs', async () => {
      const res = await request(app)
        .post('/api/analytics/correlation/analyze')
        .send({ betLeg1Id: 'not-a-uuid', betLeg2Id: '22222222-2222-2222-2222-222222222222' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when a leg is not found', async () => {
      mockService.analyzeLegPair.mockRejectedValue(new Error('One or both bet legs not found'));

      const res = await request(app)
        .post('/api/analytics/correlation/analyze')
        .send({ betLeg1Id: '11111111-1111-1111-1111-111111111111', betLeg2Id: '22222222-2222-2222-2222-222222222222' });

      expect(res.status).toBe(404);
    });

    it('forwards the scoped user id so ownership is enforced in OAuth mode', async () => {
      mockGetScopedUserId.mockReturnValueOnce('user-1');
      mockService.analyzeLegPair.mockResolvedValue(null);

      await request(app)
        .post('/api/analytics/correlation/analyze')
        .send({ betLeg1Id: '11111111-1111-1111-1111-111111111111', betLeg2Id: '22222222-2222-2222-2222-222222222222' });

      expect(mockService.analyzeLegPair).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'user-1'
      );
    });
  });

  // ─── POST /parlay ─────────────────────────────────────────────────────────
  describe('POST /api/analytics/correlation/parlay', () => {
    it('analyzes a placed bet by betId', async () => {
      mockService.analyzeParlay.mockResolvedValue({
        betLegIds: ['1', '2'],
        betId: 'bet-1',
        nominalOdds: 265,
        trueOdds: 172,
        oddsDiscrepancy: 12.5,
        riskLevel: 'medium',
        correlationFlags: [],
        recommendation: 'warning',
        reasoning: 'reasons',
        suggestedFix: null,
      } as any);

      const res = await request(app)
        .post('/api/analytics/correlation/parlay')
        .send({ betId: '11111111-1111-1111-1111-111111111111' });

      expect(res.status).toBe(200);
      expect(res.body.data.recommendation).toBe('warning');
      expect(mockService.analyzeParlay).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', undefined);
    });

    it('analyzes a draft slip by legs, resolving game commence times', async () => {
      const gameId = '33333333-3333-3333-3333-333333333333';
      (mockPrisma.game.findMany as jest.Mock).mockResolvedValue([
        { id: gameId, commenceTime: new Date('2026-08-16T18:00:00Z') },
      ] as any);
      mockService.analyzeDraftSlip.mockResolvedValue({
        betLegIds: ['draft-0', 'draft-1'],
        betId: null,
        nominalOdds: 265,
        trueOdds: 265,
        oddsDiscrepancy: 0,
        riskLevel: 'low',
        correlationFlags: [],
        recommendation: 'approve',
        reasoning: 'independent',
        suggestedFix: null,
      } as any);

      const res = await request(app)
        .post('/api/analytics/correlation/parlay')
        .send({
          legs: [
            { gameId, selectionType: 'moneyline', selection: 'home', odds: -110 },
            { gameId, selectionType: 'total', selection: 'over', odds: -110 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.recommendation).toBe('approve');
      expect(mockService.analyzeDraftSlip).toHaveBeenCalled();
    });

    it('rejects a request with both betId and legs', async () => {
      const res = await request(app)
        .post('/api/analytics/correlation/parlay')
        .send({
          betId: '11111111-1111-1111-1111-111111111111',
          legs: [{ gameId: 'game-a', selectionType: 'moneyline', selection: 'home', odds: -110 }],
        });

      expect(res.status).toBe(400);
    });

    it('rejects a request with neither betId nor legs', async () => {
      const res = await request(app).post('/api/analytics/correlation/parlay').send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /history ─────────────────────────────────────────────────────────
  describe('GET /api/analytics/correlation/history', () => {
    it('returns historical analyses', async () => {
      mockService.getHistory.mockResolvedValue([
        { id: 'analysis-1', riskLevel: 'high' },
      ] as any);

      const res = await request(app).get('/api/analytics/correlation/history');

      expect(res.status).toBe(200);
      expect(res.body.data.analyses).toHaveLength(1);
      expect(res.body.data.count).toBe(1);
    });

    it('filters by riskLevel', async () => {
      mockService.getHistory.mockResolvedValue([]);
      const res = await request(app).get('/api/analytics/correlation/history?riskLevel=high');

      expect(res.status).toBe(200);
      expect(mockService.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ riskLevel: 'high' })
      );
    });
  });

  // ─── POST /hedge ──────────────────────────────────────────────────────────
  describe('POST /api/analytics/correlation/hedge', () => {
    it('returns hedging opportunities for a leg', async () => {
      mockService.findHedgingOpportunities.mockResolvedValue([
        { gameId: 'game-a', bookmaker: 'bookB', selection: 'away', odds: 160, hedgeStake: 64.1, guaranteedProfit: 2.57, guaranteedProfitPct: 1.57 },
      ] as any);

      const res = await request(app)
        .post('/api/analytics/correlation/hedge')
        .send({ betLegId: '11111111-1111-1111-1111-111111111111' });

      expect(res.status).toBe(200);
      expect(res.body.data.opportunities).toHaveLength(1);
    });

    it('returns 404 when the leg does not exist', async () => {
      mockService.findHedgingOpportunities.mockRejectedValue(new Error('Bet leg x not found'));

      const res = await request(app)
        .post('/api/analytics/correlation/hedge')
        .send({ betLegId: '11111111-1111-1111-1111-111111111111' });

      expect(res.status).toBe(404);
    });

    it('forwards the scoped user id so ownership is enforced in OAuth mode', async () => {
      mockGetScopedUserId.mockReturnValueOnce('user-1');
      mockService.findHedgingOpportunities.mockResolvedValue([]);

      await request(app)
        .post('/api/analytics/correlation/hedge')
        .send({ betLegId: '11111111-1111-1111-1111-111111111111' });

      expect(mockService.findHedgingOpportunities).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'user-1'
      );
    });
  });

  // ─── GET /education ───────────────────────────────────────────────────────
  describe('GET /api/analytics/correlation/education', () => {
    it('returns static educational content', async () => {
      const res = await request(app).get('/api/analytics/correlation/education');

      expect(res.status).toBe(200);
      expect(res.body.data.correlationTypes).toHaveLength(4);
      expect(res.body.data.glossary.length).toBeGreaterThan(0);
      expect(res.body.data.warningLevels).toHaveLength(4);
    });
  });
});
